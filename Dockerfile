# Next.js 15 多阶段构建
#
# 为什么不用 Dokploy 默认的 nixpacks？（2026-08-23 实地排查结论）
#   1. 会 OOM：nixpacks 解压整个 nix store，在这台 8GB 的机器上被内核杀掉
#      （exit code 137），构建随机失败，而失败会让服务停在 0 副本 → 停服
#   2. 泄露密钥：nixpacks 把 DB_PASSWORD / JWT_SECRET 写进生成的 Dockerfile 的
#      ARG/ENV，密钥被烘焙进镜像层，docker history 就能看到
#   3. 慢：十几分钟起步
#
# 本文件用多阶段构建解决 2（构建参数只存在于 builder 阶段，不进最终镜像），
# 并且不碰 nix，解决 1 和 3。

# ── 依赖安装阶段 ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# 只复制依赖清单，这一层能被 Docker 缓存：
# 改业务代码时不会重新装依赖
# corepack 会读 package.json 的 packageManager 字段自动装对应版本的 pnpm。
# 不要写 pnpm@latest——那会让构建结果随时间漂移，今天能过明天可能就挂了。
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile

# ── 构建阶段 ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建期需要连数据库做预渲染（见 CLAUDE.md「渲染模型」）。
# 这些值由 Dokploy 以 --build-arg 传入。
# 关键：它们只存在于这个 builder 阶段，最终镜像里不会有——
# 这正是多阶段构建相比 nixpacks 的安全优势。
# 只声明构建期真正需要的变量。
#
# JWT_SECRET 和 ADMIN_USER_IDS 曾经也列在这里，但它们只被 lib/auth.ts 用到，
# 而 lib/auth.ts 的调用方全是动态路由（/admin/* 读 cookies、
# /api/me 与 /api/admin/* 是 Route Handler），构建期根本不执行。
# 多传一个密钥进构建参数就多一处泄露面（Docker 会为此报
# SecretsUsedInArgOrEnv 警告），所以去掉了——它们在 Environment 里有就够。
ARG DB_HOST
ARG DB_PORT
ARG DB_NAME
ARG DB_USER
ARG DB_PASSWORD
ENV DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_NAME=$DB_NAME \
    DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
# 构建前置检查：DB_HOST 必须非空。
#
# 血泪教训（2026-08-23）：Dokploy 对 **nixpacks** 构建会自动把应用的环境变量
# 传成 --build-arg，但对 **Dockerfile** 构建不会——必须在 Dokploy 的
# Build Args 字段里显式再填一遍。漏填的后果不是构建失败，而是
# lib/projects.ts 静默走 fallback，把 lib/projects-data.ts 里的样例数据
# 烘焙进产物：页面正常打开、内容却是错的，极难发现。
#
# 所以这里做确定性检查，而不是靠"数一数路由够不够多"这种启发式——
# 那个阈值我第一版设成 10，而 fallback 恰好产出 18 条，直接被绕过去了。
RUN test -n "$DB_HOST" || ( \
      echo "构建失败：DB_HOST 为空。" && \
      echo "Dockerfile 构建拿不到应用的运行时环境变量，" && \
      echo "需要在 Dokploy 的 Build Args 里显式填入 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD。" && \
      exit 1 )

# 把构建输出留档，构建后检查有没有 fallback 告警。
# 这是最直接的信号——lib/projects.ts 走 fallback 时会打印 [projects] 开头的警告。
RUN corepack enable && \
    { pnpm build > /tmp/build.log 2>&1 || { cat /tmp/build.log; exit 1; }; } && \
    cat /tmp/build.log && \
    if grep -q "\[projects\]" /tmp/build.log; then \
      echo "构建失败：构建期未能连上数据库，产物里烘焙的是 fallback 样例数据。" && \
      echo "检查 Dokploy Build Args 里的 DB_* 是否填对、以及数据库是否可达。" && \
      exit 1; \
    fi

# 附加信息：打印预渲染路由数，方便对照排查
# （不作为判定依据——fallback 也能产出接近的数量，见上面的注释）
RUN node -e "const m=require('./.next/prerender-manifest.json');console.log('静态预渲染路由数: '+Object.keys(m.routes).length)"

# ── 运行阶段 ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata

# 不用 root 跑应用。
# 这是 2026-06 那次入侵的直接教训：当时 Next.js 以 root + pm2 运行，
# 框架层 RCE（CVE-2025-66478）直接变成了服务器 root 权限。
RUN addgroup -g 1001 nodejs && adduser -D -u 1001 -G nodejs nextjs

# standalone 产物已经包含了精简后的 node_modules 和 server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 注意：本项目没有 public/ 目录，所以这里不 COPY 它。
# 将来如果添加了 public/（放 favicon、图片等静态资源），
# 要在这里补上：COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 否则那些资源不会进镜像，线上会 404。

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
