import "server-only"

// 向认证服务上报「这个用户现在活跃」。
//
// 只在服务端调用（Route Handler / Server Component）。
// 标 server-only 是一道编译期防线：万一有人从客户端组件 import 它，
// 构建会直接失败，而不是把 BACKEND_URL 这个内网地址打进浏览器包里。

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000"

/**
 * fire-and-forget 上报活跃。
 *
 * 参数是**原样转发的 Cookie 头**，不是 userId。
 *
 * 为什么不直接把 userId 传过去（那样更省事）？
 * 因为那等于让调用方声称"我是谁"。`/api/auth/*` 是经 Traefik 对公网开放的，
 * 任何人都能构造这个请求，随便填一个 userId 就能往别人账号上记活跃。
 * 后果虽然只是污染统计（拿不到数据、也提不了权），但「相信客户端自报身份」
 * 这个模式一旦开了口子，下次就会被用在更要命的地方。
 *
 * 转发 Cookie 则让 user-login 自己验签——**谁掌握密钥，谁来判断身份**，
 * 这和 one-api 接入时"不分发 JWT_SECRET"是同一条原则。
 *
 * 另外三条刻意的设计：
 *   1. 不 await，不返回任何东西 —— 调用方不需要、也不应该等它
 *   2. 任何错误都吞掉 —— 统计挂了不能让用户的页面跟着挂
 *   3. 带 3 秒超时 —— 没有超时的 fetch 在对端卡死时会一直占着连接
 */
export function reportActive(cookieHeader: string): void {
  if (!cookieHeader) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)

  fetch(`${BACKEND_URL}/api/auth/beacon?app=main`, {
    method: "POST",
    headers: { cookie: cookieHeader },
    signal: controller.signal,
    cache: "no-store",
  })
    .catch(() => {
      // 静默失败是刻意的，见上面第 2 条
    })
    .finally(() => clearTimeout(timer))
}
