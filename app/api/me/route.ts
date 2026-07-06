import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"

// GET /api/me —— 客户端导航栏查询当前登录态
// 登录态必须走接口而不是在 layout 里读 cookies()：
// layout 一旦用 cookies() 会让全站退出静态渲染，变成每请求 SSR
export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json(
    { user },
    // 登录态不允许被浏览器或中间层缓存
    { headers: { "Cache-Control": "no-store" } }
  )
}
