import { guardRead, isDbUnavailable, json } from "@/lib/intake/http"
import { getRequestForOwner } from "@/lib/intake/store"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/intake/requests/[id] —— 提交者查看自己的回执和 AI 初评进度
//   200 回执     401 未登录     404 不存在或不是你的（两种情况不区分，见 lib/intake/store.ts）
export async function GET(_request: Request, { params }: RouteContext) {
  const guard = await guardRead()
  if (!guard.ok) return guard.response
  const { id } = await params
  if (!/^rq_[A-Za-z0-9_-]{16}$/.test(id)) return json({ error: "记录不存在" }, 404)
  try {
    const view = await getRequestForOwner(id, guard.user.userId)
    if (!view) return json({ error: "记录不存在" }, 404)
    return json(view)
  } catch (err) {
    if (isDbUnavailable(err)) return json({ error: "服务暂不可用，请稍后再试" }, 503)
    throw err
  }
}
