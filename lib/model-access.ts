// 从 one-api 取当前用户的模型凭证（余额、key、充值地址）
//
// 这个文件**没有** "server-only"，是给浏览器用的：
// 请求直接从浏览器发到 /one-api/api/momorain/provision，
// 浏览器自动带上 momorain 的 session Cookie，one-api 拿它去问 user-login "这是谁"。
// 本站既不碰 key 的生成，也不需要知道 one-api 的内网地址。
//
// 契约的完整说明在 workspace 根目录的 PLATFORM.md §4.4，这里只放用得到的部分。

/** provision 成功时的 data 字段 */
export type ModelAccess = {
  /** 现在拿着这个 key 能不能调通。判断"能不能用"只看它，不要自己拼条件 */
  ready: boolean
  /** ready=false 时的原因：no_models / no_key / no_quota */
  reason?: "no_models" | "no_key" | "no_quota" | string
  hasKey: boolean
  /** "sk-…"。只放在组件 state 里，**不要存 localStorage**：one-api 那边
   *  一旦轮换了 key，缓存的旧 key 会让用户复制出一个用不了的东西 */
  key?: string
  /** OpenAI 兼容端点的前缀，实际调用时要再拼上 "/v1" */
  baseUrl: string
  /** 用量明细 / Key 管理页。会先把 momorain 登录态换成 one-api 会话再跳转 */
  consoleUrl: string
  /** 充值（兑换码）页，同上 */
  topupUrl: string
  /** 只有 hasKey 时才有 */
  quota?: {
    remain: number
    used: number
    /** 网关渲染好的余额文案（"¥0.96"）。直接显示，**不要**拿 remain 自己换算——
     *  额度单位是网关的内部概念，改一次定价各个前端就得跟着改 */
    display: string
  }
}

export type ModelAccessResult =
  | { status: "ok"; data: ModelAccess }
  | { status: "need_login" }
  | { status: "error"; message: string }

// ⚠️ 路径是**站点根的绝对路径**。/one-api 是 Traefik 路由过去的另一个应用，
// 不是本站的路由；本地开发时靠 next.config.mjs 的 rewrite 转发。
const PROVISION_URL = "/one-api/api/momorain/provision"

export async function fetchModelAccess(): Promise<ModelAccessResult> {
  let body: {
    success?: boolean
    message?: string
    need_login?: boolean
    data?: ModelAccess
  }

  try {
    const res = await fetch(PROVISION_URL, {
      credentials: "same-origin",
      // 余额是实时的，绝不能拿浏览器缓存里的旧响应
      cache: "no-store",
    })
    body = await res.json()
  } catch {
    // 两种情况会走到这里：网络断了，或者返回的根本不是 JSON。
    // 后者最常见的原因是 /one-api 没有被路由到 one-api，
    // 请求落到了本站，拿回一个 404 的 HTML 页面。
    return { status: "error", message: "模型服务暂时连不上，请稍后刷新" }
  }

  // one-api 面向浏览器的接口失败时 HTTP 状态码**也是 200**（上游的习惯），
  // 所以只能看 success 字段，不能看 res.ok。
  if (!body.success || !body.data) {
    if (body.need_login) return { status: "need_login" }
    return { status: "error", message: body.message || "获取模型额度失败" }
  }
  return { status: "ok", data: body.data }
}

/** OpenAI 兼容的调用地址。给用户复制的是这个，不是 baseUrl 本身 */
export function openAIEndpoint(access: ModelAccess): string {
  return access.baseUrl.replace(/\/$/, "") + "/v1"
}
