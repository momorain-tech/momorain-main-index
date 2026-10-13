"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react"
import { demandGroups, providerGroups, workFields, type IntakeField } from "./intake-fields"
import { ConsultationCard } from "@/components/consultation/consultation-card"
import { copyText } from "@/lib/clipboard"
import { siteConfig } from "@/config/site"
import { projectProvider } from "@/config/platform"
import { validateFields, validateContact, isDraft, type Values, type Draft } from "@/lib/intake-validation"

export type ReferenceProject = { slug: string; name: string }

// 第一阶段采用文档允许的微信人工对接。明确区分“本地整理”和“平台收到”，不伪造接收、审核或匹配。
export function IntakeForm({ kind, projects = [] }: { kind: "demand" | "provider"; projects?: ReferenceProject[] }) {
  const groups = kind === "demand" ? demandGroups : providerGroups
  const params = useSearchParams()
  const requested = params.get("project")
  // URL 只接受已发布项目的 slug，名称、提供者和地址均从可信数据生成。
  const initialReference = projects.find((p) => p.slug === requested)?.slug ?? ""
  const [reference, setReference] = useState(initialReference)
  const [values, setValues] = useState<Values>({})
  const [works, setWorks] = useState<Values[]>([{}])
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState("")
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null)
  const [consent, setConsent] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const storageKey = `aiyouhuo:intake:${kind}:v1`
  const isPreview = step === groups.length
  const project = projects.find((p) => p.slug === reference)
  const provider = project ? projectProvider(project.slug) : undefined

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isDraft(parsed)) setSavedDraft(parsed)
      }
    } catch { /* 存储不可用时仍可填写、预览和复制。 */ }
  }, [storageKey])
  function go(next: number) {
    setStep(next); setErrors({}); setNotice("")
    requestAnimationFrame(() => headingRef.current?.focus())
  }
  function saveDraft() {
    try {
      const draft: Draft = { version: 1, values, works, reference }
      localStorage.setItem(storageKey, JSON.stringify(draft)); setSavedDraft(draft)
      setNotice("草稿已保存到当前浏览器，平台尚未收到。请勿在公共设备保存联系方式。")
    } catch { setNotice("当前浏览器无法保存草稿，请保持页面打开，或在预览中手动复制资料。") }
  }
  function clearDraft() {
    try { localStorage.removeItem(storageKey); setSavedDraft(null); setNotice("已删除浏览器中的草稿，当前填写内容保留。") }
    catch { setNotice("浏览器不允许删除本地存储，请在浏览器设置中清除本站数据。") }
  }
  function restoreDraft() {
    if (!savedDraft) return
    setValues(savedDraft.values); setWorks(savedDraft.works)
    // 从 Demo 进入时优先保留本次来源，不能被旧草稿悄悄覆盖。
    setReference(initialReference || (projects.some((p) => p.slug === savedDraft.reference) ? savedDraft.reference : ""))
    setConsent(false); go(0)
  }
  function update(key: string, value: string | string[]) {
    setValues((v) => ({ ...v, [key]: value }))
  }
  function validateCurrent() {
    const next: Record<string, string> = {}
    if (kind === "provider" && step === 2) {
      works.forEach((w, i) => Object.assign(next, validateFields(workFields, w, `work-${i}-`)))
    } else Object.assign(next, validateFields(groups[step].fields, values))
    if (groups[step].fields.some((f) => f.key === "contact")) {
      const error = validateContact(values.contactType, values.contact)
      if (error) next.contact = error
    }
    setErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.getElementById(`intake-${Object.keys(next)[0]}`)?.focus())
      return false
    }
    return true
  }
  const format = (fields: IntakeField[], data: Values) => fields.flatMap((f) => {
    const raw = data[f.key]; const text = Array.isArray(raw) ? raw.join("、") : raw?.trim()
    return text ? [`${f.label}：${text}`] : []
  }).join("\n")
  const referenceText = project ? `参考作品：${project.name}\n作品链接：${siteConfig.url}/projects/${project.slug}${provider ? `\n提供者：${provider.name}` : ""}` : ""
  const demandSummary = ["【AI 项目需求 · 待平台沟通】", ...groups.map((g) => format(g.fields, values)), referenceText, "周期、费用与方案：待沟通"].filter(Boolean).join("\n\n")
  const publicScope = Array.isArray(values.publicScope) ? values.publicScope : []
  const allFields = groups.flatMap((g) => g.fields)
  // 公开意愿只是待核对范围；完整联系方式始终留在私密对接摘要中。
  const publicKeys = new Set<string>([
    ...(publicScope.includes("展示名称") ? ["displayName", "type"] : []),
    ...(publicScope.includes("一句话介绍") ? ["intro"] : []),
    ...(publicScope.includes("服务能力") ? ["directions", "problems", "deliverables", "deliveryNote", "industry", "technology", "limits", "availability", "cooperation", "pricing", "deployment"] : []),
  ])
  const workSummary = works.map((w, i) => `作品 ${i + 1}\n${format(workFields, w)}`).join("\n\n")
  const publicSummary = [format(allFields.filter((f) => publicKeys.has(f.key)), values), publicScope.includes("代表作品") ? workSummary : "", publicScope.includes("联系方式") ? "联系方式：申请公开，发布前另行核对" : ""].filter(Boolean).join("\n\n") || "暂未选择公开内容"
  const privateSummary = [format(allFields.filter((f) => !publicKeys.has(f.key)), values), !publicScope.includes("代表作品") ? workSummary : ""].filter(Boolean).join("\n\n")
  const providerSummary = `【AI 服务资料 · 待平台核对，尚未发布】\n\n拟公开信息（需按授权范围核对）\n${publicSummary}\n\n仅供平台对接\n${privateSummary}`
  const message = kind === "demand" ? demandSummary : providerSummary
  async function copySummary() {
    if (!consent) { setNotice("请先确认资料用途和发送方式。"); return }
    const ok = await copyText(message, formRef.current)
    setNotice(ok ? "资料已复制。请添加下方微信，将资料粘贴发送；平台尚未收到。" : "无法自动复制，请选中上方摘要手动复制，再通过微信发送。")
  }

  return <form className="intake-form" ref={formRef} noValidate onSubmit={(e) => { e.preventDefault(); if (!isPreview && validateCurrent()) go(step + 1) }}>
    <div className="intake-notice"><b>当前为微信人工对接</b><p>在这里整理资料，再复制发送到平台微信。填写、预览或保存草稿都不会自动提交，也不会自动生成方案、报价或审核结果。</p></div>
    {savedDraft && step === 0 && <div className="draft-banner"><span>当前浏览器有一份本地草稿。</span><button type="button" onClick={restoreDraft}>恢复草稿</button><button type="button" onClick={clearDraft}>删除草稿</button></div>}
    <ol className="intake-progress" aria-label="资料整理进度">{[...groups.map((g) => g.title), "预览与联系"].map((title, i) => <li key={title} aria-current={i === step ? "step" : undefined} className={i === step ? "current" : i < step ? "complete" : ""}><span>{i + 1}</span><b>{title}</b></li>)}</ol>
    <h2 ref={headingRef} tabIndex={-1} className="intake-step-title">{isPreview ? "核对资料，再通过微信发送" : groups[step].title}</h2>
    <p className="intake-step-desc">{isPreview ? "预览不代表已提交。平台收到微信资料后，才会人工沟通与核对。" : groups[step].description}</p>
    {!isPreview && <p className="intake-required-note">标有 * 的项目为必填，其余可以稍后沟通。</p>}
    {!isPreview && kind === "demand" && step === 0 && projects.length > 0 && <div className="intake-field"><label htmlFor="reference-project">参考 Demo（可选）</label><select id="reference-project" value={reference} onChange={(e) => setReference(e.target.value)}><option value="">暂不选择参考作品</option>{projects.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>{provider && <p className="field-hint">提供者：{provider.name} · 此信息会带入需求摘要。</p>}</div>}
    {!isPreview && groups[step].fields.map((f) => <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => update(f.key, v)} error={errors[f.key]} />)}
    {!isPreview && kind === "provider" && step === 2 && <div className="intake-works">{works.map((w, i) => <fieldset className="intake-work" key={i}><legend>作品 {i + 1}</legend>{works.length > 1 && <button className="work-remove" type="button" aria-label={`移除作品 ${i + 1}`} onClick={() => { setWorks((list) => list.filter((_, n) => n !== i)); setErrors({}) }}><Trash2 size={15} /> 移除作品</button>}{workFields.map((f) => <Field key={f.key} idPrefix={`work-${i}-`} field={f} value={w[f.key]} error={errors[`work-${i}-${f.key}`]} onChange={(v) => setWorks((list) => list.map((item, n) => n === i ? { ...item, [f.key]: v } : item))} />)}</fieldset>)}{works.length < 6 && <button type="button" className="btn-ghost btn-md" onClick={() => setWorks((list) => [...list, {}])}><Plus size={16} /> 添加代表作品</button>}</div>}
    {Object.keys(errors).length > 0 && <p role="alert" className="intake-error">还有 {Object.keys(errors).length} 项需要补充或修正，请检查上方提示。</p>}
    {isPreview && <>
      {kind === "provider" ? <><Preview title="拟公开展示 · 发布前另行核对" text={publicSummary} /><Preview title="仅供平台对接 · 不公开展示" text={privateSummary} /></> : <Preview title="需求摘要 · 仅供平台对接" text={demandSummary} />}
      <label className="intake-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>我已核对资料，可用于平台沟通与对接；我理解需自行通过微信发送，公开内容须另行确认。</span></label>
      <button type="button" className="btn-primary btn-md" disabled={!consent} onClick={copySummary}>复制资料，前往微信发送</button>
    </>}
    <div className="intake-controls">{step > 0 && <button type="button" className="btn-ghost btn-md" onClick={() => go(step - 1)}><ArrowLeft size={16} /> 上一步</button>}<button type="button" className="intake-text-button" onClick={saveDraft}>保存本地草稿</button>{!isPreview && <button type="submit" className="btn-primary btn-md">{step === groups.length - 1 ? "预览资料" : "下一步"}<ArrowRight size={16} /></button>}</div>
    <p className="field-hint">草稿仅保存在当前浏览器，可能包含联系方式。不会同步到其他设备，可用“删除草稿”清除。</p>
    {savedDraft && step !== 0 && <button type="button" className="intake-text-button" onClick={clearDraft}>删除本地草稿</button>}
    <p role="status" aria-live="polite" className="intake-status">{notice}</p>
    {isPreview && <div className="intake-contact"><ConsultationCard compact context={{ source: "intake", intent: kind }} /><div className="next-explanation"><h3>发送后会怎样？</h3><p>{kind === "demand" ? "平台人工梳理需求，沟通可行方向和相关服务方；方案、周期与费用尚待评估。双方沟通后，再确认范围、交付、验收和合作意向。" : "平台检查作品可访问性、实际职责与公开范围，有缺项时通过微信沟通。展示内容核对后再安排发布，不保证订单或对接结果。"}</p><Link href="/#projects">继续看看 Demo →</Link></div></div>}
    <noscript>资料整理需要启用 JavaScript。也可以返回首页联系方式，直接通过微信发送需求或作品。</noscript>
  </form>
}

function Field({ field: f, value, onChange, error, idPrefix = "" }: { field: IntakeField; value?: string | string[]; onChange: (v: string | string[]) => void; error?: string; idPrefix?: string }) {
  const id = `intake-${idPrefix}${f.key}`
  const hintId = `${id}-hint`, errorId = `${id}-error`
  const attributes = { id, "aria-invalid": !!error, "aria-required": !!f.required, "aria-describedby": [f.hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined }
  const title = <>{f.label}{f.required ? <span aria-label="必填"> *</span> : <small>（选填）</small>}</>
  if (f.type === "multi") {
    const selected = Array.isArray(value) ? value : []
    return <fieldset className="intake-field" {...attributes} tabIndex={-1}><legend>{title}</legend>{f.hint && <p id={hintId} className="field-hint">{f.hint}</p>}<div className="intake-options">{f.options?.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((s) => s !== option))} />{option}</label>)}</div>{error && <p id={errorId} className="field-error">{error}</p>}</fieldset>
  }
  const text = typeof value === "string" ? value : ""
  return <div className="intake-field"><label htmlFor={id}>{title}</label>{f.hint && <p className="field-hint" id={hintId}>{f.hint}</p>}
    {f.type === "textarea" ? <textarea {...attributes} rows={4} maxLength={f.max ?? 2000} required={f.required} value={text} onChange={(e) => onChange(e.target.value)} /> : f.type === "select" ? <select {...attributes} required={f.required} value={text} onChange={(e) => onChange(e.target.value)}><option value="">请选择</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select> : <input {...attributes} type={f.type === "url" ? "url" : "text"} maxLength={f.max ?? 2000} required={f.required} value={text} onChange={(e) => onChange(e.target.value)} />}
    {error && <p className="field-error" id={errorId}>{error}</p>}
  </div>
}
function Preview({ title, text }: { title: string; text: string }) {
  return <div className="intake-preview"><h3>{title}</h3><pre>{text}</pre></div>
}
