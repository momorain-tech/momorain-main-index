/** @type {import('next').NextConfig} */
const nextConfig = {
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
