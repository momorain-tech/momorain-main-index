import { validateConsultSubmission } from "@/lib/intake-validation"
import { BodyError, guardWrite, isDbUnavailable, json, rateLimited, readJson } from "@/lib/intake/http"
import { createConsult, resolveReference } from "@/lib/intake/store"

// POST /api/intake/consults —— 保存一条轻量咨询（第四版首页「我也有类似情况」）
//
// 和 POST /api/intake/requests 是同一套规矩，状态码含义也一样：
//   201 新建 / 200 + replayed 重试 / 401 未登录 / 403 非本站发起 / 409 同键不同内容
//   422 校验没过 / 429 太频繁 / 503 数据库不可用
// 频控和需求共用一个桶（request:<userId>）：两个入口加起来 10 分钟 10 次，不能靠换接口绕开
export async function POST(request: Request) {
  const guard = await guardWrite(request)
  if (!guard.ok) return guard.response
  const { user } = guard

  if (rateLimited(`request:${user.userId}`, 10, 10 * 60 * 1000))
    return json({ error: "提交太频繁，请稍后再试" }, 429)

  let body: unknown
  try {
    body = await readJson(request)
  } catch (err) {
    const status = err instanceof BodyError ? err.status : 400
    return json({ error: status === 413 ? "内容太长" : "请求格式有误" }, status)
  }

  const checked = validateConsultSubmission(body)
  if (!checked.ok) return json({ error: "资料还不完整", errors: checked.errors }, 422)

  try {
    const reference = await resolveReference(checked.value.reference)
    const outcome = await createConsult(user, checked.value, reference)
    if (outcome.kind === "conflict")
      return json({ error: "这份咨询的内容和之前提交的不一致，请刷新页面后重新提交" }, 409)
    return json(
      { ...outcome.record, ...(outcome.kind === "replayed" ? { replayed: true } : {}) },
      outcome.kind === "created" ? 201 : 200,
    )
  } catch (err) {
    if (isDbUnavailable(err)) return json({ error: "接收服务暂不可用，请稍后再试，填写内容已保留" }, 503)
    throw err
  }
}
