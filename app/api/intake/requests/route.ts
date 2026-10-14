import { validateDemandSubmission } from "@/lib/intake-validation"
import { BodyError, guardWrite, isDbUnavailable, json, rateLimited, readJson } from "@/lib/intake/http"
import { createRequest, resolveReference } from "@/lib/intake/store"

// POST /api/intake/requests —— 保存一条需求（§5.2）
//
//   201 新建成功          200 + replayed: 同一个幂等键、同样内容的重试，返回原记录
//   401 未登录            403 不是从本站页面发起
//   409 同一个幂等键提交了不同内容   422 字段校验没过（errors 按字段给出）
//   429 太频繁            503 数据库不可用（前端保留填写内容，提示稍后再试）
//
// 「201」只在数据库事务提交之后返回。AI 初评只是在同一个事务里排了个队，
// 跑没跑、成没成功都不影响这里的结果。
export async function POST(request: Request) {
  const guard = await guardWrite(request)
  if (!guard.ok) return guard.response
  const { user } = guard

  // 一个账号 10 分钟内最多 10 次提交尝试（含重试）。正常人填一份需求要好几分钟
  if (rateLimited(`request:${user.userId}`, 10, 10 * 60 * 1000))
    return json({ error: "提交太频繁，请稍后再试" }, 429)

  let body: unknown
  try {
    body = await readJson(request)
  } catch (err) {
    const status = err instanceof BodyError ? err.status : 400
    return json({ error: status === 413 ? "内容太长" : "请求格式有误" }, status)
  }

  const checked = validateDemandSubmission(body)
  if (!checked.ok) return json({ error: "资料还不完整", errors: checked.errors }, 422)

  try {
    // 参考作品：只认已发布项目，名称在服务端查。选了但查不到（刚被撤下）就当没选，不阻止提交
    const reference = await resolveReference(checked.value.reference)
    const outcome = await createRequest(user, checked.value, reference)
    if (outcome.kind === "conflict")
      return json({ error: "这份资料的内容和之前提交的不一致，请刷新页面后重新提交" }, 409)
    return json(
      { ...outcome.record, ...(outcome.kind === "replayed" ? { replayed: true } : {}) },
      outcome.kind === "created" ? 201 : 200,
    )
  } catch (err) {
    if (isDbUnavailable(err)) return json({ error: "接收服务暂不可用，请稍后再试，填写内容已保留" }, 503)
    throw err
  }
}
