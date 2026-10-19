import { NextResponse } from "next/server"

import { adminGuard } from "@/lib/intake/admin-route"
import { requeueAnalysis } from "@/lib/intake/analysis"

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/admin/intake/requests/[id]/analysis —— 管理员手动（重新）安排 AI 初评。
// 用于：失败 / 超时待核对之后确认可以再跑；提交时名额已满或模型还没配好的需求补跑。
// 不受每日上限限制——这是人工决定花这笔钱
export async function POST(request: Request, { params }: RouteContext) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response
  const result = await requeueAnalysis((await params).id)
  if (result === "not_enabled")
    return NextResponse.json({ error: "AI 初评还没配置（INTAKE_AI_* 环境变量）" }, { status: 409 })
  if (result === "consult") return NextResponse.json({ error: "轻量咨询不做 AI 初评" }, { status: 409 })
  if (result === "busy") return NextResponse.json({ error: "已经在排队或分析中" }, { status: 409 })
  return NextResponse.json({ status: "queued" })
}
