"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react"
import {
  WORK_METHODS,
  demandGroups,
  providerGroups,
  workFields,
  type IntakeField,
} from "./intake-fields"
import { WorkAssets, type UploadConfig } from "./work-assets"
import { projectProvider } from "@/config/platform"
import {
  MAX_WORKS,
  isDraft,
  isFieldVisible,
  validateContact,
  validateFields,
  validateWork,
  type AssetMeta,
  type Draft,
  type Values,
} from "@/lib/intake-validation"
import { ANALYSIS_STATUS_LABELS, formatTime, type AnalysisStatus } from "@/lib/intake/constants"

export type ReferenceProject = { slug: string; name: string }

// 需求方（/requests/new）和服务方（/providers/join）共用的分步表单。
//
// 第三版（docs/MAIN_INDEX_V3_DEVELOPMENT.md §4）：资料**真实提交到平台后台**，不再是「复制后自己发微信」。
// - 填写不用登录；点「提交」时才要求登录（服务端按登录账号记录归属，用户只能看到自己的提交）。
//   没登录时先把填写内容存进本地草稿，登录回来自动恢复，不用重填
// - 「提交成功」只看服务器的回答（201/200），不是按钮动画、也不是 AI 跑完
// - 幂等键 requestKey：同一份填写重试多少次都只落一条记录，网络超时后可以放心点「重试」
//
// 结构：字段定义在 intake-fields.ts（一份数据驱动渲染、校验、摘要、服务端接收），
// 纯校验函数在 lib/intake-validation.ts（不依赖 React，前后端共用，单独有测试）。
// step 从 0 到 groups.length - 1；最后一步就是确认并提交。

type Receipt = { id: string; createdAt: string; status: string; analysisStatus?: AnalysisStatus }
type LoginState = "unknown" | "in" | "out"

// crypto.randomUUID 只在 HTTPS 和 localhost 下可用；在局域网 IP 上调试等场景退回 getRandomValues
function makeKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function IntakeForm({
  kind,
  projects = [],
}: {
  kind: "demand" | "provider"
  projects?: ReferenceProject[]
}) {
  const groups = kind === "demand" ? demandGroups : providerGroups
  const worksStep = kind === "provider" ? 1 : -1
  const lastStep = groups.length - 1
  // useSearchParams 让这个组件只能在浏览器里渲染，所以页面要把它包在 <Suspense> 里，
  // 否则整个页面会退出静态渲染（见 app/(public)/requests/new/page.tsx）
  const params = useSearchParams()
  const requested = params.get("project")
  // URL 只接受已发布项目的 slug，名称、提供者和地址均从可信数据生成。
  const initialReference = projects.find((p) => p.slug === requested)?.slug ?? ""
  const [reference, setReference] = useState(initialReference)
  const [values, setValues] = useState<Values>({})
  const [works, setWorks] = useState<Values[]>([{}])
  const [assets, setAssets] = useState<Record<string, AssetMeta>>({})
  // 幂等键在挂载后生成（服务端渲染时不能用 crypto，也避免水合不一致）
  const [requestKey, setRequestKey] = useState("")
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState("")
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null)
  const [consent, setConsent] = useState(false)
  // AI 初评默认勾选，但写清楚送去分析的是什么、不送什么；用户可以取消
  const [analysisConsent, setAnalysisConsent] = useState(true)
  const [login, setLogin] = useState<LoginState>("unknown")
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; retry?: boolean; conflict?: boolean } | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const storageKey = `aiyouhuo:intake:${kind}:v2`
  const project = projects.find((p) => p.slug === reference)
  const provider = project ? projectProvider(project.slug) : undefined
  const loginHref = `/login?next=${encodeURIComponent(`${kind === "demand" ? "/requests/new" : "/providers/join"}?resume=1`)}`

  // 挂载后：生成幂等键、读本地草稿、查登录态、查上传是否开放（只有服务方表单需要）
  useEffect(() => {
    setRequestKey(makeKey())
    let draft: Draft | null = null
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isDraft(parsed)) draft = parsed
      }
    } catch {
      /* 存储不可用时仍可填写和提交。 */
    }
    // ?resume=1 是「提交时发现没登录 → 去登录 → 回来」这条路带的标记：自动恢复刚才那份。
    // 平时读到草稿不自动填，而是显示「恢复草稿」让用户自己选——公共电脑上可能是别人的草稿
    if (draft && params.get("resume") === "1") applyDraft(draft, true)
    else setSavedDraft(draft)

    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user: unknown }) => setLogin(d.user ? "in" : "out"))
      .catch(() => setLogin("unknown"))
    if (kind === "provider") {
      fetch("/api/intake/uploads", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: UploadConfig) => setUploadConfig(d))
        .catch(() => setUploadConfig({ enabled: false }))
    }
    // 只在挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // 「我已确认」只对勾选那一刻的内容有效：改了任何东西都要重新确认
  useEffect(() => {
    setConsent(false)
  }, [values, works, reference])

  // 换步骤后把焦点移到新步骤的标题上：读屏用户能听到「到了哪一步」，键盘用户也不会停在旧按钮上
  function go(next: number) {
    setStep(next)
    setErrors({})
    setNotice("")
    requestAnimationFrame(() => headingRef.current?.focus())
  }
  function currentDraft(): Draft {
    return { version: 2, requestKey, values, works, reference, assets }
  }
  function saveDraft(silent = false) {
    try {
      const draft = currentDraft()
      localStorage.setItem(storageKey, JSON.stringify(draft))
      setSavedDraft(draft)
      if (!silent) setNotice("草稿已保存到当前浏览器（还没有提交）。请勿在公共设备保存联系方式。")
      return true
    } catch {
      if (!silent) setNotice("当前浏览器无法保存草稿，请保持页面打开。")
      return false
    }
  }
  function clearDraft(message = "已删除浏览器中的草稿，当前填写内容保留。") {
    try {
      localStorage.removeItem(storageKey)
      setSavedDraft(null)
      if (message) setNotice(message)
    } catch {
      setNotice("浏览器不允许删除本地存储，请在浏览器设置中清除本站数据。")
    }
  }
  function applyDraft(d: Draft, toLastStep = false) {
    setValues(d.values)
    setWorks(d.works)
    setAssets(d.assets)
    setRequestKey(d.requestKey) // 沿用草稿的幂等键：万一之前那次其实提交成功了，重试不会重复
    // 从 Demo 进入时优先保留本次来源，不能被旧草稿悄悄覆盖。
    setReference(initialReference || (projects.some((p) => p.slug === d.reference) ? d.reference : ""))
    setSavedDraft(d)
    go(toLastStep ? lastStep : 0)
  }
  function update(key: string, value: string | string[]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  // 校验某一步，返回错误表（不改界面）
  function errorsOf(s: number): Record<string, string> {
    const next: Record<string, string> = {}
    if (s === worksStep) {
      works.forEach((w, i) => Object.assign(next, validateWork(w, `work-${i}-`)))
    } else Object.assign(next, validateFields(groups[s].fields, values))
    if (groups[s].fields.some((f) => f.key === "contact")) {
      const error = validateContact(values.contactType, values.contact)
      if (error) next.contact = error
    }
    return next
  }
  function showErrors(next: Record<string, string>) {
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) {
      // 出错的字段可能在折叠的「补充信息」里：先展开，再聚焦
      requestAnimationFrame(() => {
        const el = document.getElementById(`intake-${first}`)
        el?.closest("details")?.setAttribute("open", "")
        el?.focus()
      })
    }
  }
  function next() {
    const e = errorsOf(step)
    if (Object.keys(e).length) return showErrors(e)
    go(step + 1)
  }

  async function submit(freshKey = false) {
    // 前面每一步都再查一遍（草稿恢复、改了前面的内容都可能留下错误），停在第一个有错的步骤
    for (let s = 0; s <= lastStep; s++) {
      const e = errorsOf(s)
      if (Object.keys(e).length) {
        if (s !== step) go(s)
        requestAnimationFrame(() => showErrors(e))
        return
      }
    }
    if (!consent) {
      setNotice("请先勾选确认资料用途。")
      return
    }
    setSubmitError(null)
    setNeedLogin(false)
    if (login === "out") {
      // 没登录：先存草稿，再请用户去登录。登录回来时自动恢复到这一步
      saveDraft(true)
      setNeedLogin(true)
      return
    }
    const key = freshKey ? makeKey() : requestKey
    if (freshKey) setRequestKey(key)
    setSubmitting(true)
    const body =
      kind === "demand"
        ? { requestKey: key, values, reference, consent: true, analysisConsent }
        : {
            requestKey: key,
            values,
            consent: true,
            works: works.map((w) => ({ ...w, assets: w.method === "在线链接" ? [] : w.assets ?? [] })),
          }
    let res: Response
    try {
      res = await fetch(kind === "demand" ? "/api/intake/requests" : "/api/intake/provider-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
    } catch {
      // 请求发出去了但没收到回答：不知道服务器有没有存上。保留输入，用同一个键重试是安全的
      setSubmitting(false)
      setSubmitError({
        message: "网络异常，暂时不确定是否提交成功。填写内容都还在，点「重试提交」即可——同一份资料重试不会重复创建。",
        retry: true,
      })
      return
    }
    setSubmitting(false)
    const data = (await res.json().catch(() => ({}))) as Receipt & {
      error?: string
      errors?: Record<string, string>
      needLogin?: boolean
    }
    if (res.status === 201 || res.status === 200) {
      setReceipt(data)
      clearDraft("")
      requestAnimationFrame(() => headingRef.current?.focus())
      return
    }
    if (res.status === 401) {
      setLogin("out")
      saveDraft(true)
      setNeedLogin(true)
      return
    }
    if (res.status === 409) {
      setSubmitError({ message: data.error ?? "提交冲突", conflict: true })
      return
    }
    if (res.status === 422 && data.errors) {
      // 服务端校验没过（理论上前端已经挡住了，除非两边规则不一致或附件失效）：定位到对应字段
      const keys = Object.keys(data.errors)
      const target = keys.some((k) => k.startsWith("work-") || k === "assets") ? worksStep : 0
      if (target >= 0 && target !== step) go(target)
      requestAnimationFrame(() => showErrors(data.errors!))
      setSubmitError({ message: data.error ?? "还有资料需要补充，请检查标出的项目。" })
      return
    }
    setSubmitError({ message: data.error ?? "提交没有成功，请稍后再试。填写内容已保留。", retry: true })
  }

  function reset() {
    setValues({})
    setWorks([{}])
    setAssets({})
    setReference("")
    setRequestKey(makeKey())
    setReceipt(null)
    setSubmitError(null)
    go(0)
  }

  // ── 提交成功：显示回执 ──
  if (receipt) {
    const href = kind === "demand" ? `/my/requests/${receipt.id}` : `/my/applications/${receipt.id}`
    return (
      <div className="intake-form">
        <div className="intake-receipt" role="status">
          <h2 ref={headingRef} tabIndex={-1} className="intake-step-title">
            {kind === "demand" ? "需求已收到，等待平台跟进" : "服务资料已收到，等待平台审核"}
          </h2>
          <dl>
            <div>
              <dt>记录编号</dt>
              <dd className="receipt-id">{receipt.id}</dd>
            </div>
            <div>
              <dt>接收时间</dt>
              <dd>{formatTime(receipt.createdAt)}</dd>
            </div>
            <div>
              <dt>当前状态</dt>
              <dd>{kind === "demand" ? "已接收，等待平台跟进" : "待审核"}</dd>
            </div>
            {kind === "demand" && receipt.analysisStatus && (
              <div>
                <dt>AI 初评</dt>
                <dd>{ANALYSIS_STATUS_LABELS[receipt.analysisStatus]}</dd>
              </div>
            )}
          </dl>
          <p className="field-hint">
            {kind === "demand"
              ? "平台会人工查看并联系你。AI 初评只是辅助判断，结果出来后可以在进度页查看；不代表报价或承诺。"
              : "平台会核对作品和公开范围，有缺项时通过你留的联系方式沟通。审核通过不代表认证或订单承诺。"}
            本地草稿已删除。
          </p>
          <div className="intake-receipt-actions">
            <Link className="btn-primary btn-md" href={href}>
              查看进度 <ArrowRight size={16} />
            </Link>
            <button type="button" className="btn-ghost btn-md" onClick={reset}>
              再提交一份
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isLast = step === lastStep
  const visible = (fields: IntakeField[], data: Values) => fields.filter((f) => isFieldVisible(f, data))
  // 上传没开放时，作品提供方式只剩「在线链接」
  const methodOptions = uploadConfig?.enabled ? [...WORK_METHODS] : ["在线链接"]

  return (
    <form
      className="intake-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (isLast) submit()
        else next()
      }}
    >
      <div className="intake-notice">
        <b>提交后由平台后台接收，专人跟进</b>
        <p>
          填写不需要登录；点「提交」时需要用手机号登录，方便你之后查看进度。微信和邮箱联系依然可用，不受影响。
        </p>
      </div>
      {savedDraft && step === 0 && (
        <div className="draft-banner">
          <span>当前浏览器有一份本地草稿。</span>
          <button type="button" onClick={() => applyDraft(savedDraft)}>
            恢复草稿
          </button>
          <button type="button" onClick={() => clearDraft()}>
            删除草稿
          </button>
        </div>
      )}
      <ol className="intake-progress" aria-label="填写进度">
        {groups.map((g, i) => (
          <li
            key={g.title}
            aria-current={i === step ? "step" : undefined}
            className={i === step ? "current" : i < step ? "complete" : ""}
          >
            <span>{i + 1}</span>
            <b>{g.title}</b>
          </li>
        ))}
      </ol>
      <h2 ref={headingRef} tabIndex={-1} className="intake-step-title">
        {groups[step].title}
      </h2>
      <p className="intake-step-desc">{groups[step].description}</p>
      <p className="intake-required-note">标有 * 的项目为必填，其余可以稍后沟通。</p>

      {kind === "demand" && step === 0 && projects.length > 0 && (
        <div className="intake-field">
          <label htmlFor="reference-project">
            参考 Demo<small>（选填）</small>
          </label>
          <select id="reference-project" value={reference} onChange={(e) => setReference(e.target.value)}>
            <option value="">暂不选择参考作品</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          {provider && <p className="field-hint">提供者：{provider.name} · 会一起提交给平台。</p>}
        </div>
      )}

      {step !== worksStep && (
        <FieldList
          fields={visible(groups[step].fields, values)}
          values={values}
          errors={errors}
          onChange={update}
        />
      )}

      {/* 代表作品：每个作品一个 fieldset，最多 6 个。key 用下标是可以的——
          输入框都是受控组件，值来自 works 数组，删掉中间一个后不会串值 */}
      {step === worksStep && (
        <div className="intake-works">
          {works.map((w, i) => (
            <fieldset className="intake-work" key={i}>
              <legend>作品 {i + 1}</legend>
              {works.length > 1 && (
                <button
                  className="work-remove"
                  type="button"
                  aria-label={`移除作品 ${i + 1}`}
                  onClick={() => {
                    setWorks((list) => list.filter((_, n) => n !== i))
                    setErrors({})
                  }}
                >
                  <Trash2 size={15} /> 移除作品
                </button>
              )}
              <FieldList
                fields={visible(workFields, w)}
                values={w}
                errors={errors}
                idPrefix={`work-${i}-`}
                optionsOverride={{ method: methodOptions }}
                onChange={(key, v) => setWorks((list) => list.map((item, n) => (n === i ? { ...item, [key]: v } : item)))}
                after={(key) =>
                  key === "method" && (w.method === "上传截图或录屏" || w.method === "提交静态 Demo 包") ? (
                    <WorkAssets
                      id={`intake-work-${i}-assets`}
                      mode={w.method === "提交静态 Demo 包" ? "zip" : "media"}
                      ids={Array.isArray(w.assets) ? w.assets : []}
                      meta={assets}
                      config={uploadConfig}
                      loggedIn={login !== "out"}
                      loginHref={loginHref}
                      onBeforeLogin={() => saveDraft(true)}
                      error={errors[`work-${i}-assets`]}
                      onChange={(ids, added) => {
                        if (added) setAssets((m) => ({ ...m, [added.id]: added }))
                        setWorks((list) => list.map((item, n) => (n === i ? { ...item, assets: ids } : item)))
                      }}
                    />
                  ) : null
                }
              />
            </fieldset>
          ))}
          {works.length < MAX_WORKS && (
            <button type="button" className="btn-ghost btn-md" onClick={() => setWorks((list) => [...list, {}])}>
              <Plus size={16} /> 添加代表作品
            </button>
          )}
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="intake-error">
          还有 {Object.keys(errors).length} 项需要补充或修正，请检查上方提示。
        </p>
      )}

      {isLast && (
        <>
          <details className="intake-preview">
            <summary>核对已填写的内容</summary>
            <pre>{summaryText(kind, values, works, assets, project?.name)}</pre>
          </details>
          {kind === "demand" && (
            <label className="intake-consent">
              <input type="checkbox" checked={analysisConsent} onChange={(e) => setAnalysisConsent(e.target.checked)} />
              <span>
                同时请 AI 做一次需求初评（可行性、下一步、待确认问题），帮助平台更快跟进。只发送需求内容，
                <b>不发送称呼、联系方式和公司名</b>；初评由平台承担费用，不扣你的额度，结果仅供参考。
              </span>
            </label>
          )}
          <label className="intake-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {kind === "demand"
                ? "我确认以上资料可用于平台沟通与对接；联系方式只用于平台联系我，不会公开。"
                : "我确认以上资料可用于平台审核与对接；公开展示前平台会和我确认内容，联系方式不会公开。"}
            </span>
          </label>
          {needLogin && (
            <div className="intake-login" role="alert">
              <p>
                <b>提交前需要先登录。</b>
                填写内容已保存在当前浏览器，登录后会自动回到这一步，再点一次「提交」即可。
              </p>
              <a className="btn-primary btn-md" href={loginHref}>
                去登录 <ArrowRight size={16} />
              </a>
            </div>
          )}
          {submitError && (
            <div className="intake-submit-error" role="alert">
              <p>{submitError.message}</p>
              {submitError.conflict && (
                <p>
                  如果之前那次其实已经提交成功，可以在<Link href="/account">账号页「我的提交」</Link>
                  查看；确认要作为新的一份提交，请点下面的按钮。
                </p>
              )}
              {submitError.conflict && (
                <button type="button" className="btn-ghost btn-md" onClick={() => submit(true)}>
                  作为新的一份提交
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="intake-controls">
        {step > 0 && (
          <button type="button" className="btn-ghost btn-md" onClick={() => go(step - 1)}>
            <ArrowLeft size={16} /> 上一步
          </button>
        )}
        <button type="button" className="intake-text-button" onClick={() => saveDraft()}>
          保存本地草稿
        </button>
        {/* 提交中禁用按钮，防止连点；真正的去重靠服务端的幂等键 */}
        <button type="submit" className="btn-primary btn-md" disabled={submitting || (isLast && !requestKey)}>
          {isLast
            ? submitting
              ? "正在提交…"
              : submitError?.retry
                ? "重试提交"
                : kind === "demand"
                  ? "提交需求"
                  : "提交服务资料"
            : "下一步"}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </div>
      <p className="field-hint">
        草稿仅保存在当前浏览器，可能包含联系方式；提交成功后会自动删除。
        {savedDraft && step !== 0 && (
          <button type="button" className="intake-text-button" onClick={() => clearDraft()}>
            删除本地草稿
          </button>
        )}
      </p>
      <p role="status" aria-live="polite" className="intake-status">
        {notice}
      </p>
      <noscript>填写需要启用 JavaScript。也可以返回首页联系方式，直接通过微信沟通。</noscript>
    </form>
  )
}

// 一组字段：普通字段直接排，带 extra 的收进一个折叠的「补充信息（选填）」
function FieldList({
  fields,
  values,
  errors,
  onChange,
  idPrefix = "",
  optionsOverride = {},
  after,
}: {
  fields: IntakeField[]
  values: Values
  errors: Record<string, string>
  onChange: (key: string, v: string | string[]) => void
  idPrefix?: string
  optionsOverride?: Record<string, string[]>
  after?: (key: string) => React.ReactNode
}) {
  const render = (f: IntakeField) => (
    <div key={f.key}>
      <Field
        field={optionsOverride[f.key] ? { ...f, options: optionsOverride[f.key] } : f}
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
  // 折叠区里有内容或有错时默认展开，不然用户找不到自己填过的东西
  const extraOpen = extra.some((f) => (Array.isArray(values[f.key]) ? values[f.key].length : values[f.key]) || errors[idPrefix + f.key])
  return (
    <>
      {main.map(render)}
      {extra.length > 0 && (
        <details className="intake-extra" open={!!extraOpen}>
          <summary>补充信息（选填，可以稍后沟通）</summary>
          {extra.map(render)}
        </details>
      )}
    </>
  )
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
  const title = (
    <>
      {f.label}
      {f.required ? <span aria-label="必填"> *</span> : <small>（选填）</small>}
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
          type={f.type === "url" ? "url" : "text"}
          inputMode={f.type === "url" ? "url" : undefined}
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

// 最后一步「核对已填写的内容」里的纯文本摘要。藏起来的字段（条件不满足）不出现
function summaryText(
  kind: "demand" | "provider",
  values: Values,
  works: Values[],
  assets: Record<string, AssetMeta>,
  referenceName?: string,
) {
  const format = (fields: IntakeField[], data: Values) =>
    fields
      .flatMap((f) => {
        if (!isFieldVisible(f, data)) return []
        const raw = data[f.key]
        if (f.type === "check") return raw === "是" ? [`✓ ${f.label}`] : []
        const text = Array.isArray(raw) ? raw.join("、") : raw?.trim()
        return text ? [`${f.label}：${text}`] : []
      })
      .join("\n")
  const groups = kind === "demand" ? demandGroups : providerGroups
  const parts = groups.map((g) => format(g.fields, values))
  if (referenceName) parts.splice(1, 0, `参考作品：${referenceName}`)
  if (kind === "provider") {
    works.forEach((w, i) => {
      const files = (Array.isArray(w.assets) && w.method !== "在线链接" ? w.assets : [])
        .map((id) => assets[id]?.name ?? id)
        .join("、")
      parts.splice(1 + i, 0, `作品 ${i + 1}\n${format(workFields, w)}${files ? `\n附件：${files}` : ""}`)
    })
  }
  return parts.filter(Boolean).join("\n\n") || "还没有填写内容"
}

