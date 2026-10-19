"use client"

import { Mail, MessageCircle, Phone } from "lucide-react"

import { CONTACT_GROUP, CONTACT_GROUP_TEXT, type IntakeField } from "./intake-fields"
import type { Values } from "@/lib/intake-validation"

// 一组字段：普通字段直接排，带 extra 的收进一个折叠的「补充信息（选填）」。
// 完整需求 / 服务方表单（intake-form.tsx）和轻量咨询（components/consultation/consult-form.tsx）共用，
// 两边的输入框长得一样、报错方式一样。单独一个文件：咨询弹窗挂在每个公开页上，
// 只引这里就不会把整个需求表单打包进每一页
export function FieldList({
  fields,
  values,
  errors,
  onChange,
  idPrefix = "",
  optionsOverride = {},
  after,
  beforeExtra,
}: {
  fields: IntakeField[]
  values: Values
  errors: Record<string, string>
  onChange: (key: string, v: string | string[]) => void
  idPrefix?: string
  optionsOverride?: Record<string, string[]>
  after?: (key: string) => React.ReactNode
  beforeExtra?: React.ReactNode
}) {
  const resolve = (f: IntakeField): IntakeField => (optionsOverride[f.key] ? { ...f, options: optionsOverride[f.key] } : f)
  const render = (f: IntakeField) => (
    <div key={f.key}>
      <Field
        field={resolve(f)}
        idPrefix={idPrefix}
        value={values[f.key]}
        error={errors[idPrefix + f.key]}
        onChange={(v) => onChange(f.key, v)}
      />
      {after?.(f.key)}
    </div>
  )
  const main = fields.filter((f) => !f.extra)
  const extra = fields.filter((f) => f.extra)
  // 「至少填一项」的那组（联系方式）：在第一项的位置渲染整组 fieldset，组内其余项跳过
  const oneOf = main.filter((f) => f.oneOf === CONTACT_GROUP)
  const groupId = `intake-${idPrefix}${CONTACT_GROUP}`
  const groupError = errors[idPrefix + CONTACT_GROUP]
  const renderMain = (f: IntakeField) => {
    if (f.oneOf !== CONTACT_GROUP) return render(f)
    if (f !== oneOf[0]) return null
    return (
      <fieldset
        key={CONTACT_GROUP}
        id={groupId}
        tabIndex={-1}
        className="intake-field intake-contacts"
        aria-invalid={!!groupError}
        aria-describedby={[`${groupId}-hint`, groupError ? `${groupId}-error` : ""].filter(Boolean).join(" ")}
      >
        <legend>
          {CONTACT_GROUP_TEXT.legend}
          <span aria-label="必填"> *</span>
        </legend>
        <p id={`${groupId}-hint`} className="field-hint">
          {CONTACT_GROUP_TEXT.hint}
        </p>
        {groupError && (
          <p id={`${groupId}-error`} className="field-error">
            {groupError}
          </p>
        )}
        {oneOf.map(render)}
      </fieldset>
    )
  }
  // 折叠区里有内容或有错时默认展开，不然用户找不到自己填过的东西
  const extraOpen = extra.some((f) => (Array.isArray(values[f.key]) ? values[f.key].length : values[f.key]) || errors[idPrefix + f.key])
  return (
    <>
      {main.map(renderMain)}
      {beforeExtra}
      {extra.length > 0 && (
        <details className="intake-extra" open={!!extraOpen}>
          <summary>补充信息（选填，可以稍后沟通）</summary>
          {extra.map(render)}
        </details>
      )}
    </>
  )
}

// 联系方式三个输入框标题前的小图标
const icons: Record<string, React.ReactNode> = {
  电话: <Phone size={15} aria-hidden />,
  微信: <MessageCircle size={15} aria-hidden />,
  邮箱: <Mail size={15} aria-hidden />,
}

// 单个字段。按 type 渲染成输入框 / 多行文本 / 下拉 / 一组复选框 / 单个勾选框，
// 并把提示和错误用 aria-describedby 关联到输入框上，读屏软件聚焦时会一起读出来
function Field({
  field: f,
  value,
  onChange,
  error,
  idPrefix = "",
}: {
  field: IntakeField
  value?: string | string[]
  onChange: (v: string | string[]) => void
  error?: string
  idPrefix?: string
}) {
  const id = `intake-${idPrefix}${f.key}`
  const hintId = `${id}-hint`,
    errorId = `${id}-error`
  const attributes = {
    id,
    "aria-invalid": !!error,
    "aria-required": !!f.required,
    "aria-describedby": [f.hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined,
  }
  // 「至少填一项」组里的字段单看都是选填，但标「选填」会让人以为整组都可以不填，所以不标
  const title = (
    <>
      {f.oneOf && icons[f.label]}
      {f.label}
      {f.required ? <span aria-label="必填"> *</span> : f.oneOf ? null : <small>（选填）</small>}
    </>
  )
  const errorNode = error && (
    <p id={errorId} className="field-error">
      {error}
    </p>
  )
  if (f.type === "check") {
    return (
      <div className="intake-field">
        <label className="intake-check" htmlFor={id}>
          <input {...attributes} type="checkbox" checked={value === "是"} onChange={(e) => onChange(e.target.checked ? "是" : "")} />
          <span>
            {f.label}
            {f.required && <span aria-label="必填"> *</span>}
          </span>
        </label>
        {errorNode}
      </div>
    )
  }
  if (f.type === "choice") {
    // 单选按钮组：选项少（≤5 个）时比下拉好用，一眼能看全，手机上也不用弹出选择器。
    // 用真正的 <input type="radio">（视觉上做成胶囊按钮）：键盘方向键切换、读屏「第几项共几项」都是浏览器自带的
    return (
      <fieldset className="intake-field" {...attributes} tabIndex={-1}>
        <legend>{title}</legend>
        {f.hint && (
          <p id={hintId} className="field-hint">
            {f.hint}
          </p>
        )}
        <div className="intake-choices">
          {f.options?.map((option) => (
            <label key={option}>
              <input type="radio" name={id} value={option} checked={value === option} onChange={() => onChange(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {errorNode}
      </fieldset>
    )
  }
  if (f.type === "multi") {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="intake-field" {...attributes} tabIndex={-1}>
        <legend>{title}</legend>
        {f.hint && (
          <p id={hintId} className="field-hint">
            {f.hint}
          </p>
        )}
        <div className="intake-options">
          {f.options?.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((s) => s !== option))}
              />
              {option}
            </label>
          ))}
        </div>
        {errorNode}
      </fieldset>
    )
  }
  const text = typeof value === "string" ? value : ""
  return (
    <div className="intake-field">
      <label htmlFor={id}>{title}</label>
      {f.hint && (
        <p className="field-hint" id={hintId}>
          {f.hint}
        </p>
      )}
      {f.type === "textarea" ? (
        <textarea
          {...attributes}
          rows={4}
          placeholder={f.placeholder}
          maxLength={f.max ?? 2000}
          required={f.required}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : f.type === "select" ? (
        <select {...attributes} required={f.required} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">请选择</option>
          {f.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input
          {...attributes}
          // 手机上 type=tel 弹拨号盘、type=email 弹带 @ 的键盘。表单是 noValidate，
          // 浏览器不会拿自己的规则拦提交，真正的校验仍是 lib/intake-validation.ts
          type={f.type === "url" ? "url" : f.inputMode === "tel" ? "tel" : f.inputMode === "email" ? "email" : "text"}
          inputMode={f.type === "url" ? "url" : f.inputMode}
          autoComplete={f.autoComplete}
          placeholder={f.placeholder}
          maxLength={f.max ?? 2000}
          required={f.required}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {errorNode}
    </div>
  )
}
