import { revalidateProjectPages } from "@/lib/revalidate-project"
import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import {
  STATUS_ACTIONS,
  deleteProject,
  updateProject,
  updateProjectStatus,
  validateProjectInput,
  validateSlug,
  type StatusAction,
} from "@/lib/projects-admin"

// Next.js 15 中动态段参数是 Promise，需要 await
type RouteContext = { params: Promise<{ slug: string }> }

// PUT /api/admin/projects/[slug] —— 更新项目（slug 是主键，不允许改）
export async function PUT(request: Request, { params }: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = validateSlug((await params).slug)
  if (!slug) {
    return NextResponse.json({ error: "slug 格式不合法" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 })
  }

  const result = validateProjectInput(body)
  if (!result.ok) {
    // 422 = 格式没问题，但内容还不够发布（附缺项清单）；400 = 格式本身不对
    return NextResponse.json(
      { error: result.error, missing: result.missing },
      { status: result.missing ? 422 : 400 }
    )
  }

  const updated = await updateProject(slug, result.value)
  if (!updated) {
    return NextResponse.json({ error: `项目 "${slug}" 不存在` }, { status: 404 })
  }

  revalidateProjectPages(slug)

  return NextResponse.json({ slug })
}

// PATCH /api/admin/projects/[slug] —— 只切换状态：{ action: "publish" | "unpublish" | "stop-trial" }
// 不碰内容字段，所以列表页上一键撤下不会冲掉案例内容
export async function PATCH(request: Request, { params }: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = validateSlug((await params).slug)
  if (!slug) {
    return NextResponse.json({ error: "slug 格式不合法" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 })
  }
  const action = (body as Record<string, unknown>)?.action
  if (!STATUS_ACTIONS.includes(action as StatusAction)) {
    return NextResponse.json(
      { error: `action 必须是 ${STATUS_ACTIONS.join(" / ")} 之一` },
      { status: 400 }
    )
  }

  const result = await updateProjectStatus(slug, action as StatusAction)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, missing: result.missing },
      { status: result.status }
    )
  }

  // 首页和详情页一起刷新：只刷首页的话，下架的详情页还能从 ISR 缓存里打开（§9.3 第 6 条）
  revalidateProjectPages(slug)

  return NextResponse.json({ slug, published: result.project.published })
}

// DELETE /api/admin/projects/[slug] —— 删除项目
export async function DELETE(_request: Request, { params }: RouteContext) {
  const denied = await requireAdmin()
  if (denied) return denied

  const slug = validateSlug((await params).slug)
  if (!slug) {
    return NextResponse.json({ error: "slug 格式不合法" }, { status: 400 })
  }

  const deleted = await deleteProject(slug)
  if (!deleted) {
    return NextResponse.json({ error: `项目 "${slug}" 不存在` }, { status: 404 })
  }

  revalidateProjectPages(slug)

  return NextResponse.json({ slug })
}
