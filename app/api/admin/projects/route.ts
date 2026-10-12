import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import {
  createProject,
  validateProjectInput,
  validateSlug,
} from "@/lib/projects-admin"

// POST /api/admin/projects —— 新建项目
export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 })
  }

  const slug = validateSlug((body as Record<string, unknown>)?.slug)
  if (!slug) {
    return NextResponse.json(
      { error: "slug 只能由小写字母、数字和中划线组成，如 my-project" },
      { status: 400 }
    )
  }

  const result = validateProjectInput(body)
  if (!result.ok) {
    // 422 = 格式没问题，但内容还不够发布（附缺项清单）；400 = 格式本身不对
    return NextResponse.json(
      { error: result.error, missing: result.missing },
      { status: result.missing ? 422 : 400 }
    )
  }

  try {
    await createProject(slug, result.value)
  } catch (err) {
    // slug 是主键，重复插入时 MySQL 报 ER_DUP_ENTRY，转成友好的 409
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: `slug "${slug}" 已存在` }, { status: 409 })
    }
    throw err
  }

  // 数据变了，让 ISR 页面立即重新生成，而不是等 5 分钟的 revalidate 窗口
  revalidatePath("/")
  revalidatePath(`/projects/${slug}`)

  return NextResponse.json({ slug }, { status: 201 })
}
