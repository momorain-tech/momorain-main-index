import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { isAdmin, verifySessionToken, type SessionUser } from "@/lib/session"

// 验签和管理员判断的实现在 lib/session.ts（middleware 也要用，见那边的说明）。
// 这里转出一份，原来 import "@/lib/auth" 的地方不用改。
export { isAdmin, type SessionUser }

// 只能在服务端调用（Server Component / Route Handler / Server Action）
// 浏览器里没有 cookies()，也不应该暴露 JWT_SECRET
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get("session")?.value)
}

// 管理 API 的门卫：不放行时返回错误响应，放行时返回 null
// 每个 /api/admin/* 的 handler 开头都必须调用。
//
// 这是**第二道**防线。第一道是 middleware.ts：非管理员的请求在那里就被当成
// "路径不存在"，根本走不到这里。这道保留下来，是为了 middleware 的 matcher
// 哪天被改漏了（比如新加的接口路径没被匹配上）时，接口仍然是关着的。
//
// 未登录和非管理员都回 404，不回 401 / 403：后两者等于告诉对方
// "这个接口存在，只是你没权限"——这正是要藏起来的信息。
export async function requireAdmin(): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!isAdmin(user)) {
    return new NextResponse(null, { status: 404 })
  }
  return null
}
