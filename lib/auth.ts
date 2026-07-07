import { jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export type SessionUser = {
  userId: string
  openid: string
  nickname: string
  avatarUrl: string
}

// 超级用户白名单：ADMIN_USER_IDS 环境变量，逗号分隔多个 userId
// 现阶段用户少，用白名单最简单；以后用户多了可升级为数据库 role 字段，
// 只需改这个函数的实现，调用方不用动
export function isAdmin(user: SessionUser | null): boolean {
  if (!user) return false
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  return adminIds.includes(user.userId)
}

// 只能在服务端调用（Server Component / Route Handler / Server Action）
// 浏览器里没有 cookies()，也不应该暴露 JWT_SECRET
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) return null

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    return {
      userId: payload.userId as string,
      openid: payload.openid as string,
      nickname: payload.nickname as string,
      avatarUrl: (payload.avatarUrl as string) ?? "",
    }
  } catch {
    // token 过期或签名错误，视为未登录
    return null
  }
}

// 管理 API 的统一门卫：不放行时返回错误响应，放行时返回 null
// 每个 /api/admin/* 的 handler 开头都必须调用——前端把按钮藏起来
// 只是体验，真正的安全边界在这里（任何人都可以直接 curl 这些接口）
export async function requireAdmin(): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "需要超级用户权限" }, { status: 403 })
  }
  return null
}
