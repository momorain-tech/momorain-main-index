import { NextResponse } from "next/server"

import { adminGuard, patchResponse, readPatch } from "@/lib/intake/admin-route"
import { adminPatchApplication } from "@/lib/intake/store"

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/admin/intake/providers/[id] —— 审核服务申请：改审核状态、指派、写给对方的说明、内部备注。
// 参数同需求跟进接口，status 取值是审核状态（pending_review / needs_info / ready_to_publish / published / declined）。
// 改成「已发布」不会自动把作品写进公开列表——公开展示仍在「项目管理」里另行录入并过发布检查
export async function PATCH(request: Request, { params }: RouteContext) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response
  const patch = await readPatch(request)
  if (!patch) return NextResponse.json({ error: "请求格式有误" }, { status: 400 })
  return patchResponse(await adminPatchApplication((await params).id, guard.admin, patch))
}
