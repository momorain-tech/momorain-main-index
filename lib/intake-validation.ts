import type { IntakeField } from "@/components/participation/intake-fields"

export type Values = Record<string, string | string[]>
export type Draft = { version: 1; values: Values; works: Values[]; reference: string }

// 条件字段当前是否生效。表单渲染、校验、生成摘要三处都用它，保证「看不见的字段」不会出现在任何一处
export function isFieldVisible(f: IntakeField, data: Values) {
  return !f.showWhen || data[f.showWhen.key] === f.showWhen.value
}

// 这些校验只保护本地整理体验；未来接真实接收接口时，服务端仍须独立校验。
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
    if (f.required && empty) errors[prefix + f.key] = `请填写${f.label}`
    if (f.options && !empty) {
      const choices = Array.isArray(value) ? value : [value]
      if (choices.some((v) => !f.options!.includes(v)))
        errors[prefix + f.key] = "请选择列表中的有效选项"
    }
    if (f.type === "url" && typeof value === "string" && value.trim()) {
      try {
        const u = new URL(value)
        if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error()
      } catch {
        errors[prefix + f.key] = "请填写完整的 http:// 或 https:// 链接，不包含账号密码"
      }
    }
    if (typeof value === "string" && value.length > (f.max ?? 2000))
      errors[prefix + f.key] = "文字超出长度限制，请精简"
  }
  return errors
}
// 本地存储也可能过期或被改写，恢复前先检查结构与大小，避免异常草稿破坏表单。
export function isDraft(input: unknown): input is Draft {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false
  const d = input as Record<string, unknown>
  const values = (v: unknown): v is Values =>
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
  return (
    d.version === 1 &&
    values(d.values) &&
    Array.isArray(d.works) &&
    d.works.length > 0 &&
    d.works.length <= 6 &&
    d.works.every(values) &&
    typeof d.reference === "string" &&
    d.reference.length <= 100
  )
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
