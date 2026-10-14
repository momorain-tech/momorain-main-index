import { guardRead, isDbUnavailable, json } from "@/lib/intake/http"
import { getApplicationForOwner } from "@/lib/intake/store"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/intake/provider-applications/[id] —— 申请人查看自己的申请状态、附件和部署进度。
// 部署地址只在「已上线」时返回（见 store.ts 的 deploymentsFor）
export async function GET(_request: Request, { params }: RouteContext) {
  const guard = await guardRead()
  if (!guard.ok) return guard.response
  const { id } = await params
  if (!/^pa_[A-Za-z0-9_-]{16}$/.test(id)) return json({ error: "记录不存在" }, 404)
  try {
    const view = await getApplicationForOwner(id, guard.user.userId)
    if (!view) return json({ error: "记录不存在" }, 404)
    return json(view)
  } catch (err) {
    if (isDbUnavailable(err)) return json({ error: "服务暂不可用，请稍后再试" }, 503)
    throw err
  }
}
