import "server-only"
import { NextResponse } from "next/server"

import { getCurrentUser, isAdmin, type SessionUser } from "@/lib/auth"
import { isSameOrigin, readJson } from "@/lib/intake/http"
import type { AdminPatch, PatchOutcome } from "@/lib/intake/store"

// 后台资料接收接口共用的门卫和响应转换。
// 未登录 / 非管理员一律 404（和 requireAdmin 同一约定，第一道防线是 middleware.ts）
export async function adminGuard(request: Request): Promise<{ ok: true; admin: SessionUser } | { ok: false; response: NextResponse }> {
  const user = await getCurrentUser()
  if (!isAdmin(user)) return { ok: false, response: new NextResponse(null, { status: 404 }) }
  // 写操作同样要求同源：管理员的 Cookie 权限最大，更不能被别的站借去发请求
  if (!isSameOrigin(request)) return { ok: false, response: NextResponse.json({ error: "请从后台页面操作" }, { status: 403 }) }
  return { ok: true, admin: user }
}

export async function readPatch(request: Request): Promise<AdminPatch | null> {
  let body: Record<string, unknown>
  try {
    body = (await readJson(request, 64 * 1024)) as Record<string, unknown>
  } catch {
    return null
  }
  if (!body || typeof body !== "object" || !Number.isInteger(body.expectedVersion)) return null
  const str = (v: unknown) => (typeof v === "string" ? v : undefined)
  return {
    expectedVersion: body.expectedVersion as number,
    status: str(body.status),
    assign: body.assign === "me" || body.assign === "none" ? body.assign : undefined,
    customerNote: str(body.customerNote),
    note: str(body.note),
  }
}

export function patchResponse(outcome: PatchOutcome) {
  switch (outcome.kind) {
    case "ok":
      return NextResponse.json({ version: outcome.version })
    case "not_found":
      return NextResponse.json({ error: "记录不存在" }, { status: 404 })
    case "conflict":
      return NextResponse.json({ error: "这条记录刚被其他管理员修改过，请刷新后再改" }, { status: 409 })
    case "invalid":
      return NextResponse.json({ error: outcome.error }, { status: 400 })
  }
}
