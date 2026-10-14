import { NextResponse } from "next/server"

import { adminGuard, patchResponse } from "@/lib/intake/admin-route"
import { readJson } from "@/lib/intake/http"
import { adminUpdateDeployment } from "@/lib/intake/store"

type RouteContext = { params: Promise<{ id: string; work: string }> }

// PUT /api/admin/intake/providers/[id]/deployments/[work] —— 登记一个 Demo 包的部署结果（人工工单）
//   ← { expectedVersion, status, publicUrl?, failureSummary? }
// 「已上线」必须带 https 地址，且应当是部署在**独立展示域名**上、实际打开验证过的地址（§7.3）
export async function PUT(request: Request, { params }: RouteContext) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response
  const { id, work } = await params
  const workIndex = Number(work)
  if (!Number.isInteger(workIndex) || workIndex < 0 || workIndex > 20)
    return NextResponse.json({ error: "作品编号无效" }, { status: 400 })
  let body: Record<string, unknown>
  try {
    body = (await readJson(request, 16 * 1024)) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "请求格式有误" }, { status: 400 })
  }
  if (!body || !Number.isInteger(body.expectedVersion) || typeof body.status !== "string")
    return NextResponse.json({ error: "请求格式有误" }, { status: 400 })
  return patchResponse(
    await adminUpdateDeployment(id, workIndex, guard.admin, {
      expectedVersion: body.expectedVersion as number,
      status: body.status,
      publicUrl: typeof body.publicUrl === "string" ? body.publicUrl : undefined,
      failureSummary: typeof body.failureSummary === "string" ? body.failureSummary : undefined,
    }),
  )
}
