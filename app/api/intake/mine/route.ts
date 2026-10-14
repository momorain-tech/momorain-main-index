import { guardRead, isDbUnavailable, json } from "@/lib/intake/http"
import { listMine } from "@/lib/intake/store"

// GET /api/intake/mine —— 当前账号提交过的需求和服务申请（账号页「我的提交」用）
export async function GET() {
  const guard = await guardRead()
  if (!guard.ok) return guard.response
  try {
    return json({ items: await listMine(guard.user.userId) })
  } catch (err) {
    if (isDbUnavailable(err)) return json({ error: "服务暂不可用，请稍后再试" }, 503)
    throw err
  }
}
