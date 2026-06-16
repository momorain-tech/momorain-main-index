import { jwtVerify } from "jose"
import { cookies } from "next/headers"

export type SessionUser = {
  userId: string
  openid: string
  nickname: string
  avatarUrl: string
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
