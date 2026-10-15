import {
  CONTACT_GROUP,
  CONTACT_KEYS,
  CONTACT_TYPES,
  demandGroups,
  migrateLegacyContact,
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
  // 是否同意 AI 初评。2026-10 补的可选字段（旧草稿没有它，按「没同意」处理）：
  // 以前不存，用户取消勾选 → 去登录 → 回来，勾选框又回到默认值，等于替用户改了主意
  analysisConsent?: boolean
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
    // 下拉是「选」不是「填」，提示语跟着变
    if (f.required && empty) errors[prefix + f.key] = f.type === "select" ? `请选择${f.label}` : `请填写${f.label}`
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

// 电话：先去掉空格、短横线、括号、点这些分隔符再判断，用户爱怎么写都行。
// 支持三类：国内手机号（可带 +86 / 0086）、带区号的固定电话（可带分机）、400/800 热线；
// 另外放过 + 开头的国际号码（E.164：+ 加 7—15 位数字）——第二版就允许带国家区号，不能收紧掉
const MOBILE = /^(?:86)?1[3-9]\d{9}$/
const LANDLINE = /^0\d{2,3}\d{7,8}(?:(?:转|ext\.?|x|#)\d{1,6})?$/i
const HOTLINE = /^[48]00\d{7}$/
const INTERNATIONAL = /^\+[1-9]\d{6,14}$/
export function isPhone(input: string) {
  const s = input.replace(/[\s\-().]/g, "")
  // 写了 +86 / 0086 的，去掉国家码按国内号码判断（固定电话的区号前面那个 0 写不写都行）
  const cn = /^(?:\+86|0086)(.+)$/.exec(s)
  if (cn) return MOBILE.test(cn[1]) || LANDLINE.test("0" + cn[1].replace(/^0/, "")) || HOTLINE.test(cn[1])
  return MOBILE.test(s) || LANDLINE.test(s) || HOTLINE.test(s) || INTERNATIONAL.test(s)
}
// 微信号的官方规则：6—20 位，字母开头，只能有字母、数字、下划线、减号。
// 很多人的微信能用手机号搜到，所以也放过手机号（hint 里写了）
const WECHAT_ID = /^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/
export function isWechat(input: string) {
  return WECHAT_ID.test(input) || MOBILE.test(input.replace(/[\s-]/g, "").replace(/^(?:\+86|0086)/, ""))
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 单个联系方式的格式检查。空值不在这里管（「至少填一项」由 contactErrors 判断）
export function validateContact(type: unknown, input: unknown): string | undefined {
  const contact = typeof input === "string" ? input.trim() : ""
  if (!contact) return undefined
  if (contact.length > 100) return "太长了，请检查"
  if (type === "邮箱") return EMAIL.test(contact) ? undefined : "邮箱格式不对，例如 name@example.com"
  if (type === "电话")
    return isPhone(contact) ? undefined : "请填写有效的手机号，或带区号的固定电话（如 0571-88886666）"
  if (type === "微信")
    return isWechat(contact) ? undefined : "微信号是 6—20 位字母、数字、下划线或减号，以字母开头；也可以填绑定微信的手机号"
  return "联系方式类型无效"
}

// 联系方式的两类错误：
// · 一项都没填 → 挂在整组上（键 = CONTACT_GROUP，表单把它显示在三个输入框上方并聚焦这一组）
// · 填了但格式不对 → 挂在那一项自己身上
// 表单的「下一步」、需求提交、服务方提交三处都走这一个函数
export function contactErrors(values: Values): Record<string, string> {
  const errors: Record<string, string> = {}
  let filled = 0
  for (const type of CONTACT_TYPES) {
    const key = CONTACT_KEYS[type]
    const v = values[key]
    if (typeof v !== "string" || !v.trim()) continue
    filled++
    const error = validateContact(type, v)
    if (error) errors[key] = error
  }
  if (!filled) errors[CONTACT_GROUP] = "电话、微信、邮箱至少填一项，方便平台联系你"
  return errors
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
  // 上线那一刻还开着旧页面的人，交上来的是旧格式（contactType + contact），先搬到新字段上
  const values = isValues(b.values) ? migrateLegacyContact(b.values) : {}
  if (!isValues(b.values)) errors.values = "资料格式有误"
  Object.assign(errors, validateFields(allDemandFields, values), contactErrors(values))
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
  // 上线那一刻还开着旧页面的人，交上来的是旧格式（contactType + contact），先搬到新字段上
  const values = isValues(b.values) ? migrateLegacyContact(b.values) : {}
  if (!isValues(b.values)) errors.values = "资料格式有误"
  Object.assign(errors, validateFields(allProviderFields, values), contactErrors(values))
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
    (d.analysisConsent === undefined || typeof d.analysisConsent === "boolean") &&
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
