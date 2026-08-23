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

  // rewrites 把 /api/auth/** 的请求转发给后端 Go 服务
  // 本地开发时生效；生产环境由 nginx 在更上层做同样的事，请求不会到达这里
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) return []
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backendUrl}/api/auth/:path*`,
      },
    ]
  },
}

export default nextConfig
