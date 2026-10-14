import "server-only"
import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"

import { getCurrentUser, type SessionUser } from "@/lib/auth"
import { isDbConfigured } from "@/lib/db"

// 资料接收接口共用的几样东西：生成 id、同源校验、登录检查、频控、统一的 JSON 响应。

// 不可猜的记录编号：前缀 + 16 位 base64url（96 bit 随机）。
// 前缀让人一眼看出是哪类记录（rq_ 需求 / pa_ 服务申请 / as_ 素材）
export function newId(prefix: "rq" | "pa" | "as"): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  // 私密数据一律不缓存：浏览器、CDN、Next 自己的缓存都不行
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

// 同源校验：写接口只接受本站页面发来的请求。
//
// 为什么不只靠 Cookie 的 SameSite？session Cookie 的域是 .momorain.com，
// 所有 *.momorain.com 子站（包括以后可能放不可信内容的子域）都算「同站」，
// SameSite=Lax 拦不住它们发来的 POST。所以要看 Origin 头：浏览器发 POST 时一定会带，
// 页面脚本改不了它。Origin 的主机名必须和这次请求的 Host 一样。
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  // 生产环境在 Traefik 后面：Traefik 默认原样转发 Host 头，X-Forwarded-Host 作为兜底
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return !!host && new URL(origin).host === host
  } catch {
    return false
  }
}

type Guarded = { ok: true; user: SessionUser } | { ok: false; response: NextResponse }

// 写接口的统一门卫：同源 → 数据库可用 → 已登录。
// 顺序有讲究：先挡跨站请求（最便宜），再看服务本身能不能用
export async function guardWrite(request: Request): Promise<Guarded> {
  if (!isSameOrigin(request))
    return { ok: false, response: json({ error: "请从本站页面提交" }, 403) }
  return guardRead()
}
export async function guardRead(): Promise<Guarded> {
  if (!isDbConfigured())
    return { ok: false, response: json({ error: "接收服务暂不可用，请稍后再试或通过微信联系" }, 503) }
  const user = await getCurrentUser()
  if (!user) return { ok: false, response: json({ error: "请先登录", needLogin: true }, 401) }
  return { ok: true, user }
}

// 进程内滑动窗口频控。只防「一个账号短时间狂刷」，不是精确的全局限额——
// 多副本时每个副本各算各的，重启会清零。真正的成本上限在 AI 任务和上传配额那里按数据库算
const buckets = new Map<string, number[]>()
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return true
  }
  hits.push(now)
  buckets.set(key, hits)
  // 防止 Map 无限长大：偶尔清一下过期的键
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k)
  }
  return false
}

export async function readJson(request: Request, maxBytes = 256 * 1024): Promise<unknown> {
  // 先看声明的长度，再看实际读到的长度（Content-Length 可以不写或写假的）
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > maxBytes) throw new BodyError(413)
  const text = await request.text()
  if (new TextEncoder().encode(text).length > maxBytes) throw new BodyError(413)
  try {
    return JSON.parse(text)
  } catch {
    throw new BodyError(400)
  }
}
export class BodyError extends Error {
  constructor(public status: number) {
    super(`body ${status}`)
  }
}

// 数据库连接类错误 → 503（「接收服务不可用」），其余照常抛给 Next 记日志
export function isDbUnavailable(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? ""
  return /^(ECONNREFUSED|ETIMEDOUT|PROTOCOL_CONNECTION_LOST|ER_NO_SUCH_TABLE|ENOTFOUND|ER_ACCESS_DENIED_ERROR)$/.test(
    code,
  )
}
