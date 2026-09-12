import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { reportActive } from "@/lib/beacon"

// GET /api/me —— 客户端导航栏查询当前登录态
// 登录态必须走接口而不是在 layout 里读 cookies()：
// layout 一旦用 cookies() 会让全站退出静态渲染，变成每请求 SSR
export async function GET() {
  const user = await getCurrentUser()

  // 活跃度上报。
  //
  // 为什么要在这里补一刀？简历工坊和视频转手绘每次开页面都调
  // user-login 的 /api/auth/session，认证服务天然看得见它们的活跃。
  // 但主站的登录态是本地用 jose 验签的（正是为了少一次跨服务调用），
  // 所以 user-login 完全不知道主站有人来过——不补的话，
  // 看板上主站的活跃永远是 0，而且不会有任何报错提示你。
  //
  // 不 await：上报慢了或挂了都不该拖慢这个接口。
  if (user) {
    // 转发 Cookie 而不是 userId——让认证服务自己验签，
    // 见 lib/beacon.ts 里的说明
    const jar = await cookies()
    reportActive(
      jar
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ")
    )
  }

  return NextResponse.json(
    // 刻意不返回 isAdmin：这个接口每个访客都会调，
    // 返回"你是不是管理员"等于向所有人宣告站点有管理后台。
    // 管理员身份只在 /admin 和 /api/admin/* 的服务端判断（requireAdmin）
    { user },
    // 登录态不允许被浏览器或中间层缓存
    { headers: { "Cache-Control": "no-store" } }
  )
}
