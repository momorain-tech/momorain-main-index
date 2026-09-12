import { jwtVerify } from "jose"

// 登录态的验签与管理员判断——纯函数，不依赖 next/headers
//
// 为什么从 lib/auth.ts 里拆出来？middleware.ts 也要用它，而 middleware
// 跑在 Edge 运行时：那里没有 next/headers 的 cookies()，只能自己从请求里
// 取出 token 字符串再验。把"验一个 token 字符串"做成纯函数，两边就能共用
// 同一份逻辑，不会出现"middleware 放行了、页面却不认"这种两套规则对不上的情况。
//
// jose 用的是 Web Crypto API，Node 和 Edge 两个运行时都能跑。

export type SessionUser = {
  userId: string
  openid: string
  // 后端签发 JWT 时已经把手机号脱敏成 138****1234 才写进 token。
  // 原因：JWT 只是 base64 编码不是加密，任何拿到它的人都能解出内容，
  // 完整手机号不该出现在这里。需要完整号码的场景由后端按 userId 查库。
  phone: string
  nickname: string
  avatarUrl: string
}

/** 验证 session Cookie 里的 JWT，无效或过期返回 null */
export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return {
      userId: payload.userId as string,
      openid: payload.openid as string,
      phone: (payload.phone as string) ?? "",
      nickname: payload.nickname as string,
      avatarUrl: (payload.avatarUrl as string) ?? "",
    }
  } catch {
    // token 过期或签名错误，视为未登录
    return null
  }
}

// 超级用户白名单：ADMIN_USER_IDS 环境变量，逗号分隔多个 userId
// 现阶段用户少，用白名单最简单；以后用户多了可升级为数据库 role 字段，
// 只需改这个函数的实现，调用方不用动
//
// 返回类型写成 `user is SessionUser`（类型谓词）而不是 boolean：
// 这样 `if (!isAdmin(user)) notFound()` 之后，TypeScript 就知道 user 不是 null，
// 调用方不用再额外写一遍 `!user ||`
export function isAdmin(user: SessionUser | null): user is SessionUser {
  if (!user) return false
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  return adminIds.includes(user.userId)
}
