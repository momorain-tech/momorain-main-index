import { validateProviderSubmission } from "@/lib/intake-validation"
import { BodyError, guardWrite, isDbUnavailable, json, rateLimited, readJson } from "@/lib/intake/http"
import { AssetRefError, createApplication } from "@/lib/intake/store"

// POST /api/intake/provider-applications —— 保存服务方资料与代表作品（§5.2）
// 状态码约定同 POST /api/intake/requests。另外：
//   422 也用于「引用了不属于你、已被用过或类型不对的附件」
// 提交后状态是「待审核」。这只是一份申请，不会改动公开的服务方名单和作品列表
export async function POST(request: Request) {
  const guard = await guardWrite(request)
  if (!guard.ok) return guard.response
  const { user } = guard

  if (rateLimited(`application:${user.userId}`, 10, 10 * 60 * 1000))
    return json({ error: "提交太频繁，请稍后再试" }, 429)

  let body: unknown
  try {
    body = await readJson(request)
  } catch (err) {
    const status = err instanceof BodyError ? err.status : 400
    return json({ error: status === 413 ? "内容太长" : "请求格式有误" }, status)
  }

  const checked = validateProviderSubmission(body)
  if (!checked.ok) return json({ error: "资料还不完整", errors: checked.errors }, 422)

  try {
    const outcome = await createApplication(user, checked.value)
    if (outcome.kind === "conflict")
      return json({ error: "这份资料的内容和之前提交的不一致，请刷新页面后重新提交" }, 409)
    return json(
      { ...outcome.record, ...(outcome.kind === "replayed" ? { replayed: true } : {}) },
      outcome.kind === "created" ? 201 : 200,
    )
  } catch (err) {
    if (err instanceof AssetRefError) return json({ error: err.message, errors: { assets: err.message } }, 422)
    if (isDbUnavailable(err)) return json({ error: "接收服务暂不可用，请稍后再试，填写内容已保留" }, 503)
    throw err
  }
}
