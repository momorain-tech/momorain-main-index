import { NextResponse } from "next/server"

import { adminGuard, patchResponse, readPatch } from "@/lib/intake/admin-route"
import { adminPatchRequest } from "@/lib/intake/store"

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/admin/intake/requests/[id] —— 跟进一条需求：改状态、指派、写给对方的说明、记内部备注
//   ← { expectedVersion, status?, assign?: "me" | "none", customerNote?, note? }
//   → 200 { version }   409 别人刚改过（乐观锁）   400 参数不对
export async function PATCH(request: Request, { params }: RouteContext) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response
  const patch = await readPatch(request)
  if (!patch) return NextResponse.json({ error: "请求格式有误" }, { status: 400 })
  return patchResponse(await adminPatchRequest((await params).id, guard.admin, patch))
}
