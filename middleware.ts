import { NextResponse, type NextRequest } from "next/server"

import { isAdmin, verifySessionToken } from "@/lib/session"

// 管理后台的第一道门：非管理员访问 /admin 或 /api/admin，一律当成"路径不存在"
//
// 为什么要在 middleware 里做，而不是只靠 /admin 布局和 requireAdmin()？
// 因为有些请求**根本不会执行到我们的代码**：比如 /api/admin/projects 只写了 POST，
// 有人发 GET 过来，Next.js 在路由层就直接回 405 Method Not Allowed——
// 等于告诉对方"这个地址存在，只是方法不对"。middleware 在路由之前运行，
// 能把这类请求也一起挡掉。
//
// "当成不存在"的做法是 rewrite 到一个确实不存在的路径，让 Next.js 渲染
// 它自己的 404 页。这样拿到的响应和访问任何一个乱写的地址完全一样，
// 而不是一个"看起来像 404"的自制页面——后者只要和真 404 有一个字节不同，
// 就能被拿来比对出后台的存在。
//
// 已知的两处缝隙（2026-09-12 实测，本地 standalone 生产构建）：
//   1. 响应头会多一个 `x-middleware-rewrite: /__not_found__`。这是 Next.js 在
//      resolve-routes 里无条件加的（客户端路由要用），应用代码删不掉。
//      响应体和真 404 逐字节一致（除去回显的请求路径和每次都变的随机 key）。
//      要做到完全一致，只能在 Traefik 上把这个响应头删掉。
//   2. 本仓库是公开的，读源码就知道 /admin 存在。所以这一层挡的是普通用户和
//      按状态码扫描的脚本，不是专门来找的人。
//
// ⚠️ 这是"不张扬"，不是唯一的防线。页面和接口里的服务端校验照样保留。

// 一个保证不存在的路径。只在服务端内部 rewrite 用，浏览器地址栏不会变
const NOT_FOUND_PATH = "/__not_found__"

export async function middleware(request: NextRequest) {
  const user = await verifySessionToken(request.cookies.get("session")?.value)
  if (isAdmin(user)) return NextResponse.next()
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url))
}

// 只匹配后台路径，其余页面完全不经过 middleware——
// 首页等静态页面的性能和渲染方式都不受影响。
// "/admin/:path*" 里的 * 表示零段或多段，所以 /admin 本身也会匹配到。
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
