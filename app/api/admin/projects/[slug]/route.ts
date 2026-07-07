import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import {
  deleteProject,
  updateProject,
  validateProjectInput,
  validateSlug,
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
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const updated = await updateProject(slug, result.value)
  if (!updated) {
    return NextResponse.json({ error: `项目 "${slug}" 不存在` }, { status: 404 })
  }

  revalidatePath("/")
  revalidatePath(`/projects/${slug}`)

  return NextResponse.json({ slug })
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

  revalidatePath("/")
  revalidatePath(`/projects/${slug}`)

  return NextResponse.json({ slug })
}
