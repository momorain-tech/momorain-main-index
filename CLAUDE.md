# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

momorain-tech 主页前端：Next.js 15（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 风格组件。展示团队项目列表（首页三个分区 + 项目详情页），带微信扫码登录（后端为独立 Go 服务）。无测试框架。

## 常用命令

```bash
pnpm dev      # 本地开发（无需 MySQL，自动用静态 fallback 数据）
pnpm build    # 生产构建（配置了 DB 环境变量时会在构建期连库预渲染）
pnpm start    # 运行生产构建
pnpm lint     # ESLint
```

## 环境变量（`.env.local`，不提交）

- `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` — MySQL 连接
- `JWT_SECRET` — 验证 session cookie 的 JWT 签名（须与后端 Go 服务一致）
- `BACKEND_URL` — 开发环境下 `/api/auth/*` rewrite 的目标（生产由 nginx 上层代理，请求不经过 Next）
- `ADMIN_USER_IDS` — 超级用户白名单，逗号分隔的 userId；决定谁能访问 `/admin` 管理后台

## 架构

### 渲染模型（最重要的约束）

全站是**静态 + ISR**：首页和 `projects/[slug]` 都 `export const revalidate = 300`，构建时预渲染、之后每 5 分钟后台按 DB 最新数据重新生成。

**不要在 root layout（或任何被它引用的 Server Component）里调用 `cookies()` / `headers()`**——这会让所有路由退出静态渲染，整站变成每请求 SSR + 每请求查库（曾发生过，靠 prerender-manifest.json 为空发现）。登录态的正确获取方式：客户端组件 `components/user-nav.tsx` 挂载后请求 `GET /api/me`。

验证渲染模式是否正常：build 后 `.next/prerender-manifest.json` 的 `routes` 应有 ~17 条静态路由（不要只看 build 输出的 ●/○ 标记，它可能误导）。

### 数据层（单向依赖：页面 → lib/projects.ts → lib/db.ts）

- `lib/db.ts` — mysql2 连接池，global 单例防 dev 热更新泄漏；`typeCast` 用 `field.string("utf8")` 自动 parse JSON 列
- `lib/projects.ts` — 唯一的公开数据 API（`getHomeProjects` / `getProjectBySlug` / `getAllSlugs`），内部做 `ProjectRow`（snake_case 数据库行）→ `Project`（camelCase）映射；页面只 import 这个模块，不感知 DB 结构
- `lib/projects-data.ts` — 静态 fallback，**仅当 DB 环境变量缺失时**使用（触发时 console.warn）。DB 配置了但连不上 = 直接报错（fail fast），不静默降级。此文件是本地开发样例，可能与线上 DB 漂移，不要当作数据源头修改——数据源头是 MySQL `projects` 表
- 表结构：`projects`（主键 slug，`category` ENUM recommended/trending/starred + `sort_order` 排序，`tags` 为 JSON 列，`wiki` TEXT 为管理员内部记录——**只在管理端读写，绝不进访客端查询**）；迁移文件按序号放 `migrations/`，服务器执行必须带 `--default-character-set=utf8mb4`

### 登录流程

1. 导航栏「登录」→ `/api/auth/mock/login?redirect=true`（开发时 rewrite 到 Go 后端，见 `next.config.mjs`）
2. 后端验证后种下 `session` HttpOnly cookie（JWT），跳回 `/dashboard`（目前仅 redirect 回首页）
3. `lib/auth.ts` 的 `getCurrentUser()` 用 jose 验证 JWT——**仅限服务端调用**（Route Handler / Server Component），客户端只能 import 它的类型
4. 登录态展示：`UserNav`（client）→ `GET /api/me`（`Cache-Control: no-store`）
5. 退出：form POST `/auth/logout`，删 cookie 后 redirect

### 管理后台（/admin，仅超级用户）

- 权限模型：复用微信登录的 session，`lib/auth.ts` 的 `isAdmin()` 对照 `ADMIN_USER_IDS` 白名单判断超级用户（以后可升级为数据库 role 字段，只需改这一个函数）
- 双层守卫：`app/admin/layout.tsx` 拦页面（非管理员 redirect 首页）；每个 `/api/admin/*` handler 开头调 `requireAdmin()` 拦 API——前端藏按钮不是安全边界
- 数据层：`lib/projects-admin.ts`（含写操作和输入校验），与只读的 `lib/projects.ts` 分开；管理后台必须有数据库，DB 未配置时列表页显示提示、写操作直接报错，**没有静态 fallback**
- `/admin` 下路由因 layout 读 cookies() 而是每请求 SSR，不影响站点其余静态路由
- 写操作成功后调 `revalidatePath` 立即刷新 ISR 页面，不等 5 分钟窗口
- CRUD 接口：`POST /api/admin/projects`、`PUT/DELETE /api/admin/projects/[slug]`（slug 是主键，创建后不可改）
- 项目 Wiki：`/admin/projects/[slug]/wiki` 查看/编辑管理员内部记录（部署方法等），走独立的 `PUT /api/admin/projects/[slug]/wiki` 单字段更新（不复用整项目 PUT，避免客户端漏传字段冲掉数据）；wiki 不在访客页面出现，写操作无需 revalidatePath

## 部署

服务器上 pm2 进程名 `momorain-main-index`，端口 3000。流程：

```bash
git pull && pnpm install && pnpm build && pm2 restart momorain-main-index
```

注意：构建期需要能连上 MySQL（`.env.local` 已配置），否则 build 会静默烘焙 fallback 静态数据——部署后检查日志里没有 `[projects]` 开头的 fallback 告警。服务器访问方式等敏感信息见 workspace 级 CLAUDE.md（不入库）。
