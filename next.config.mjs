/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone 模式：构建产物是一个自包含的 .next/standalone 目录，
  // 里面只有运行时真正用到的依赖（Next.js 自己做了 tree-shaking），
  // 不需要把整个 node_modules 塞进镜像。
  //
  // 没有它的话 Docker 镜像要背着几百 MB 的 node_modules；
  // 有了它最终镜像通常只有几十 MB。
  // 对本地 `pnpm dev` 完全没有影响，只作用于 `pnpm build`。
  output: "standalone",

  // rewrites 把 /api/auth/** 转发给后端 Go 服务（user-login）。
  //
  // ⚠️ 只在本地开发生效。生产环境由 Traefik 直接把 /api/auth 路由到
  // user-login 服务，请求根本不会到达本应用。
  //
  // 为什么必须区分？rewrites 是**构建期**求值的，结果被固化进
  // standalone 产物，读不到部署时才注入的环境变量。
  // 2026-08-23 就是这么出的事故：切到 Dockerfile 构建后 BACKEND_URL
  // 没进 Build Args，构建时为空 → rewrites 烘焙成 []，
  // 线上 /api/auth/* 直接 404，登录整个不可用。
  //
  // 所以生产不再依赖它，改由 Traefik 路由（也顺带解开了
  // 「主站挂了所有站点都登不上」的耦合）。
  async rewrites() {
    if (process.env.NODE_ENV === "production") return []
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backendUrl}/api/auth/:path*`,
      },
    ]
  },
}

export default nextConfig
