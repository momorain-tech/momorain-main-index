import { NextResponse } from "next/server"

import { getCurrentUser, isAdmin } from "@/lib/auth"

// GET /api/me —— 客户端导航栏查询当前登录态
// 登录态必须走接口而不是在 layout 里读 cookies()：
// layout 一旦用 cookies() 会让全站退出静态渲染，变成每请求 SSR
export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json(
    // isAdmin 只影响导航栏显示"管理"入口，不是安全边界——
    // 管理页面和 API 在服务端各自还会验一遍
    { user, isAdmin: isAdmin(user) },
    // 登录态不允许被浏览器或中间层缓存
    { headers: { "Cache-Control": "no-store" } }
  )
}
