import {
  demandGroups,
  providerGroups,
  workFields,
  type IntakeField,
} from "@/components/participation/intake-fields"

// 两类表单的纯校验函数：浏览器用它做即时提示，服务端接口（app/api/intake/*）用**同一份**做真正的拦截。
// 前端校验只是体验，不是安全边界——有人绕过页面直接调接口，服务端照样会挡。
// 这个文件不能 import 服务端模块（mysql2、node:crypto……），否则会被打包进浏览器。

export type Values = Record<string, string | string[]>
// 第 2 版草稿：多了 requestKey（幂等键）和作品附件的展示信息。
// 第 1 版（第二版网站的字段）结构不同，不再恢复——本地草稿的 key 也换成了 v2
export type AssetMeta = { id: string; name: string; type: "image" | "video" | "zip"; size: number }
export type Draft = {
  version: 2
  requestKey: string
  values: Values
  works: Values[]
  reference: string
  assets: Record<string, AssetMeta>
}

export const MAX_WORKS = 6
export const MAX_ASSETS_PER_WORK = 6

// 条件字段当前是否生效。表单渲染、校验、生成摘要、服务端接收四处都用它，
// 保证「看不见的字段」不会出现在任何一处
export function isFieldVisible(f: IntakeField, data: Values) {
  return !f.showWhen || data[f.showWhen.key] === f.showWhen.value
}

export function validateFields(fields: IntakeField[], data: Values, prefix = "") {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    if (!isFieldVisible(f, data)) continue // 藏起来的字段里残留的旧值不报错（摘要里也会跳过它）
    const value = data[f.key],
      empty = Array.isArray(value) ? value.length === 0 : !value?.trim()
    if (
      value !== undefined &&
      ((f.type === "multi" && !Array.isArray(value)) ||
        (f.type !== "multi" && typeof value !== "string"))
    ) {
      errors[prefix + f.key] = "资料格式有误，请重新填写"
      continue
    }
    if (f.type === "check") {
      if (value && value !== "是") errors[prefix + f.key] = "资料格式有误，请重新勾选"
      else if (f.required && !value) errors[prefix + f.key] = "请勾选确认"
      continue
    }
    if (f.required && empty) errors[prefix + f.key] = `请填写${f.label}`
    if (f.options && !empty) {
      const choices = Array.isArray(value) ? value : [value]
      if (choices.some((v) => !f.options!.includes(v)))
        errors[prefix + f.key] = "请选择列表中的有效选项"
    }
    if (f.type === "url" && typeof value === "string" && value.trim()) {
      try {
        const u = new URL(value.trim())
        if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error()
      } catch {
        errors[prefix + f.key] = "请填写完整的 http:// 或 https:// 链接，不包含账号密码"
      }
    }
    if (typeof value === "string" && value.trim() && f.min && value.trim().length < f.min)
      errors[prefix + f.key] = `再多写几句吧，至少 ${f.min} 个字`
    if (typeof value === "string" && value.length > (f.max ?? 2000))
      errors[prefix + f.key] = "文字超出长度限制，请精简"
  }
  return errors
}

export function validateContact(type: unknown, input: unknown): string | undefined {
  const contact = typeof input === "string" ? input.trim() : ""
  if (!contact) return "请填写联系方式"
  if (type === "邮箱")
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? undefined : "请填写有效的邮箱地址"
  if (type === "电话")
    return /^\+?[\d\s()-]{6,25}$/.test(contact) && contact.replace(/\D/g, "").length >= 6
      ? undefined
      : "请填写有效的联系电话，可包含国家区号"
  if (type === "微信")
    return contact.length >= 2 && contact.length <= 100 && !/\s/.test(contact)
      ? undefined
      : "请填写可联系的微信号，不包含空格"
  return "请选择联系方式类型"
}

// 只保留「定义过、当前可见、非空」的字段，字符串去掉首尾空白。
// 两个用途：1) 服务端只存它认识的字段，客户端多塞的键直接丢掉；
// 2) 顺序跟着字段定义走，同样的内容永远得到同样的 JSON —— 幂等判断靠这个算哈希
export function normalizeValues(fields: IntakeField[], data: Values): Values {
  const out: Values = {}
  for (const f of fields) {
    if (!isFieldVisible(f, data)) continue
    const v = data[f.key]
    if (Array.isArray(v)) {
      // 多选按选项定义的顺序排，勾选先后不同也算同一份内容
      const picked = (f.options ?? []).filter((o) => v.includes(o))
      if (picked.length) out[f.key] = picked
    } else if (typeof v === "string" && v.trim()) out[f.key] = v.trim()
  }
  return out
}

// 幂等键：浏览器为「这一次填写」生成，重试时带同一个
export function isRequestKey(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(v)
}
// 服务端生成的素材 id（见 lib/intake/ids.ts）
export function isAssetId(v: unknown): v is string {
  return typeof v === "string" && /^as_[A-Za-z0-9_-]{16,32}$/.test(v)
}
function isSlug(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9-]{1,100}$/.test(v)
}

const allDemandFields = demandGroups.flatMap((g) => g.fields)
const allProviderFields = providerGroups.flatMap((g) => g.fields)

type Invalid = { ok: false; errors: Record<string, string> }

export type DemandSubmission = {
  requestKey: string
  values: Values
  reference: string // 参考作品 slug，空字符串 = 没选。服务端再去已发布列表里核对
  analysisConsent: boolean
}
// 需求方提交的完整校验（前端最后一步、服务端接口都调它）
export function validateDemandSubmission(body: unknown): { ok: true; value: DemandSubmission } | Invalid {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: Record<string, string> = {}
  if (!isRequestKey(b.requestKey)) errors.requestKey = "页面状态异常，请刷新后重试"
  const values = isValues(b.values) ? b.values : {}
  if (!isValues(b.values)) errors.values = "资料格式有误"
  Object.assign(errors, validateFields(allDemandFields, values))
  const contactError = validateContact(values.contactType, values.contact)
  if (contactError) errors.contact = contactError
  if (b.consent !== true) errors.consent = "请确认资料用途"
  const reference = b.reference === undefined || b.reference === "" ? "" : b.reference
  if (reference !== "" && !isSlug(reference)) errors.reference = "参考作品无效"
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      requestKey: b.requestKey as string,
      values: normalizeValues(allDemandFields, values),
      reference: reference as string,
      analysisConsent: b.analysisConsent === true,
    },
  }
}

export type ProviderSubmission = {
  requestKey: string
  profile: Values
  works: (Values & { assets?: string[] })[]
}
// 每个作品除了字段本身，还要按「提供方式」检查附件数量。
// 附件是不是这个人自己的、类型对不对，要查库，留给服务端（lib/intake/store.ts）
export function validateWork(w: Values, prefix = ""): Record<string, string> {
  const errors = validateFields(workFields, w, prefix)
  const assets = Array.isArray(w.assets) ? w.assets : []
  if (w.assets !== undefined && (!Array.isArray(w.assets) || !assets.every(isAssetId)))
    errors[prefix + "assets"] = "附件信息有误，请重新上传"
  else if (w.method === "上传截图或录屏" && (assets.length < 1 || assets.length > MAX_ASSETS_PER_WORK))
    errors[prefix + "assets"] = `请上传 1—${MAX_ASSETS_PER_WORK} 个截图或录屏`
  else if (w.method === "提交静态 Demo 包" && assets.length !== 1)
    errors[prefix + "assets"] = "请上传一个 ZIP 格式的静态 Demo 包"
  return errors
}
export function validateProviderSubmission(body: unknown): { ok: true; value: ProviderSubmission } | Invalid {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const errors: Record<string, string> = {}
  if (!isRequestKey(b.requestKey)) errors.requestKey = "页面状态异常，请刷新后重试"
  const values = isValues(b.values) ? b.values : {}
  if (!isValues(b.values)) errors.values = "资料格式有误"
  Object.assign(errors, validateFields(allProviderFields, values))
  const contactError = validateContact(values.contactType, values.contact)
  if (contactError) errors.contact = contactError
  const works = Array.isArray(b.works) ? b.works : []
  if (works.length < 1 || works.length > MAX_WORKS || !works.every(isValues))
    errors.works = `请整理 1—${MAX_WORKS} 个代表作品`
  else works.forEach((w, i) => Object.assign(errors, validateWork(w as Values, `work-${i}-`)))
  if (b.consent !== true) errors.consent = "请确认资料用途和授权范围"
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      requestKey: b.requestKey as string,
      profile: normalizeValues(allProviderFields, values),
      works: (works as Values[]).map((w) => {
        const out: Values & { assets?: string[] } = normalizeValues(workFields, w)
        // 附件只在「上传」两种方式下保留；改成在线链接后残留的旧附件不提交
        if (w.method !== "在线链接" && Array.isArray(w.assets) && w.assets.length)
          out.assets = Array.from(new Set(w.assets as string[]))
        return out
      }),
    },
  }
}

// 资料对象的结构检查：键数、字符串长度、数组长度都有上限，
// 防止有人往接口里塞一个几十 MB 的 JSON（也用于恢复本地草稿）
function isValues(v: unknown): v is Values {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.entries(v).length <= 80 &&
    Object.values(v).every((x) =>
      typeof x === "string"
        ? x.length <= 4000
        : Array.isArray(x) &&
          x.length <= 20 &&
          x.every((s) => typeof s === "string" && s.length < 200),
    )
  )
}

// 本地存储也可能过期或被改写，恢复前先检查结构与大小，避免异常草稿破坏表单。
export function isDraft(input: unknown): input is Draft {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false
  const d = input as Record<string, unknown>
  const assets = d.assets as Record<string, unknown> | undefined
  return (
    d.version === 2 &&
    isRequestKey(d.requestKey) &&
    isValues(d.values) &&
    Array.isArray(d.works) &&
    d.works.length > 0 &&
    d.works.length <= MAX_WORKS &&
    d.works.every(isValues) &&
    typeof d.reference === "string" &&
    d.reference.length <= 100 &&
    !!assets &&
    typeof assets === "object" &&
    !Array.isArray(assets) &&
    Object.keys(assets).length <= MAX_WORKS * MAX_ASSETS_PER_WORK &&
    Object.entries(assets).every(
      ([id, m]) =>
        isAssetId(id) &&
        !!m &&
        typeof m === "object" &&
        typeof (m as AssetMeta).name === "string" &&
        (m as AssetMeta).name.length <= 200 &&
        ["image", "video", "zip"].includes((m as AssetMeta).type) &&
        typeof (m as AssetMeta).size === "number",
    )
  )
}
