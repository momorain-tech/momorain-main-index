import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth"
import { updateProjectWiki, validateSlug, validateWiki } from "@/lib/projects-admin"

// PUT /api/admin/projects/[slug]/wiki —— 只更新 wiki 一个字段
//
// 为什么单独开接口、不复用整项目的 PUT：
// 整体更新要求客户端回传全部字段，wiki 编辑页只有 wiki 一个输入框，
// 若复用就得先查出其余字段再原样传回，漏一个字段就把数据冲掉了。
// "改哪个字段就只传哪个字段"的接口更不容易出这种事故

type RouteContext = { params: Promise<{ slug: string }> }

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

  const result = validateWiki((body as Record<string, unknown>)?.wiki)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const updated = await updateProjectWiki(slug, result.value)
  if (!updated) {
    return NextResponse.json({ error: `项目 "${slug}" 不存在` }, { status: 404 })
  }

  // 注意：这里不调 revalidatePath——wiki 不出现在任何访客页面，
  // /admin 下的页面本来就是每请求 SSR，没有需要刷新的静态缓存
  return NextResponse.json({ slug })
}
