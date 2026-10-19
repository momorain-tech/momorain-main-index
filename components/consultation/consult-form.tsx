"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  CONSULT_SCENES,
  CONSULT_STAGE_PROJECT,
  consultFields,
} from "@/components/participation/intake-fields"
import { FieldList } from "@/components/participation/field-list"
import {
  contactErrors,
  isConsultDraft,
  validateFields,
  type ConsultDraft,
  type Values,
} from "@/lib/intake-validation"
import { formatTime } from "@/lib/intake/constants"

// 轻量咨询表单（第四版建议 §7）：给「还在了解」的访客一个比完整需求轻得多的起点——
// 两道选择题 + 一句选填补充 + 联系方式，提交后进后台同一个队列，由团队人工联系。
//
// 和完整需求表单（components/participation/intake-form.tsx）同一套做法，只是更短：
// - 浏览、填写不用登录；点「提交」才要求手机号登录（提交前就写清楚，不让人填完才发现）
// - 没登录时先把填写内容存进本地草稿 → 去登录 → 回到原页面，ConsultationProvider 看到
//   ?consult=resume 自动重新打开这个弹窗并恢复内容（见 consultation-provider.tsx）
// - 幂等键 requestKey：网络超时后点「重试」不会重复创建
// - 「已有明确项目」的人提示去完整需求页，场景和参考作品带过去，不用从头选
//
// 微信复制、看二维码不算「咨询成功」（第四版 §7），所以成功回执只在服务器回 201/200 时出现

export const CONSULT_DRAFT_KEY = "aiyouhuo:intake:consult:v1"

type Receipt = { id: string; createdAt: string }
type LoginState = "unknown" | "in" | "out"

function makeKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function ConsultForm({
  scene,
  project,
  draft,
}: {
  scene?: string
  project?: { slug: string; name: string }
  // 登录回来时由 ConsultationProvider 读出来的本地草稿；有它就恢复，没有就按 scene 预选
  draft?: ConsultDraft
}) {
  const [values, setValues] = useState<Values>(() =>
    draft
      ? draft.values
      : scene && (CONSULT_SCENES as readonly string[]).includes(scene)
        ? { scene }
        : {},
  )
  const reference = draft ? draft.reference : project?.slug ?? ""
  const [requestKey, setRequestKey] = useState(draft?.requestKey ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [login, setLogin] = useState<LoginState>("unknown")
  const [needLogin, setNeedLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; retry?: boolean } | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [notice, setNotice] = useState(draft ? "已恢复登录前填写的内容，勾选确认后再点提交。" : "")
  const receiptRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!requestKey) setRequestKey(makeKey())
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user: unknown }) => setLogin(d.user ? "in" : "out"))
      .catch(() => setLogin("unknown"))
    // 只在挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(key: string, value: string | string[]) {
    setValues((v) => ({ ...v, [key]: value }))
    setConsent(false) // 和需求表单一样：确认只对勾选那一刻的内容有效
  }

  function saveDraft() {
    try {
      const d: ConsultDraft = { version: 1, requestKey, values, reference }
      localStorage.setItem(CONSULT_DRAFT_KEY, JSON.stringify(d))
      return true
    } catch {
      return false
    }
  }
  function clearDraft() {
    try {
      localStorage.removeItem(CONSULT_DRAFT_KEY)
    } catch {
      /* 删不掉也不影响：草稿只在下次 ?consult=resume 时才会被读 */
    }
  }

  // 登录回来的地址：当前页面 + ?consult=resume（保留 #锚点，回来还在原来的位置）
  function loginHref() {
    if (typeof window === "undefined") return "/login"
    const url = new URL(window.location.href)
    url.searchParams.set("consult", "resume")
    return `/login?next=${encodeURIComponent(url.pathname + url.search + url.hash)}`
  }

  // 错误表的键要带上 FieldList 的 idPrefix（"consult-"）：同一页上可能还有完整需求表单，
  // 两边的输入框 id 不能撞（intake-consult-phone 和 intake-phone）
  function showErrors(next: Record<string, string>) {
    const prefixed = Object.fromEntries(Object.entries(next).map(([k, v]) => [`consult-${k}`, v]))
    setErrors(prefixed)
    const first = Object.keys(prefixed)[0]
    if (first) requestAnimationFrame(() => document.getElementById(`intake-${first}`)?.focus())
  }

  async function submit() {
    const e = { ...validateFields(consultFields, values), ...contactErrors(values) }
    if (Object.keys(e).length) return showErrors(e)
    setErrors({})
    if (!consent) {
      setNotice("请先勾选确认联系方式的用途。")
      return
    }
    setNotice("")
    setSubmitError(null)
    setNeedLogin(false)
    if (login === "out") {
      saveDraft()
      setNeedLogin(true)
      return
    }
    setSubmitting(true)
    let res: Response
    try {
      res = await fetch("/api/intake/consults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey, values, reference, consent: true }),
        cache: "no-store",
      })
    } catch {
      setSubmitting(false)
      setSubmitError({
        message: "网络异常，暂时不确定是否提交成功。填写内容都还在，点「重试提交」即可，不会重复创建。",
        retry: true,
      })
      return
    }
    setSubmitting(false)
    const data = (await res.json().catch(() => ({}))) as Receipt & { error?: string; errors?: Record<string, string> }
    if (res.status === 201 || res.status === 200) {
      setReceipt(data)
      clearDraft()
      requestAnimationFrame(() => receiptRef.current?.focus())
      return
    }
    if (res.status === 401) {
      setLogin("out")
      saveDraft()
      setNeedLogin(true)
      return
    }
    if (res.status === 422 && data.errors) {
      showErrors(data.errors)
      setSubmitError({ message: data.error ?? "还有内容需要补充，请检查标出的项目。" })
      return
    }
    setSubmitError({ message: data.error ?? "提交没有成功，请稍后再试。填写内容已保留。", retry: true })
  }

  if (receipt) {
    return (
      <div className="intake-receipt consult-receipt" role="status">
        <h3 ref={receiptRef} tabIndex={-1}>
          已收到，团队会按你留的联系方式联系你
        </h3>
        <dl>
          <div>
            <dt>记录编号</dt>
            <dd className="receipt-id">{receipt.id}</dd>
          </div>
          <div>
            <dt>接收时间</dt>
            <dd>{formatTime(receipt.createdAt)}</dd>
          </div>
        </dl>
        <p className="field-hint">进度和团队的留言可以随时查看，也在账号页「我的提交」里。</p>
        <Link className="btn-primary btn-md" href={`/my/requests/${receipt.id}`}>
          查看进度 <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  const wantsFullRequest = values.stage === CONSULT_STAGE_PROJECT
  const requestHref = `/requests/new?${new URLSearchParams({
    ...(typeof values.scene === "string" ? { scene: values.scene } : {}),
    ...(reference ? { project: reference } : {}),
  })}`

  return (
    <form
      className="consult-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {project && (
        <p className="consult-source">
          从作品进入：<b>{project.name}</b>（会一起交给团队参考）
        </p>
      )}
      <FieldList
        fields={consultFields}
        values={values}
        errors={errors}
        onChange={update}
        idPrefix="consult-"
      />
      {wantsFullRequest && (
        <div className="consult-upgrade" role="note">
          <p>已经有明确的项目？可以直接填完整需求（问题、期望结果、预算和时间），团队评估得更快。</p>
          <Link className="inline-link" href={requestHref}>
            继续填写完整需求 →
          </Link>
          <p className="field-hint">也可以先这样提交，团队联系时再细聊。</p>
        </div>
      )}
      <label className="intake-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>我确认以上内容可用于团队联系我、评估合作；联系方式不会公开，也不会发给 AI 模型。</span>
      </label>
      {/* 提交前就说清楚要登录（第四版 §7），不让人填完才发现 */}
      {!needLogin && login !== "in" && <p className="field-hint">提交时需要用手机号验证码登录，方便你之后查看进度。</p>}
      {needLogin && (
        <div className="intake-login" role="alert">
          <p>
            <b>提交前需要先用手机号登录。</b>
            填写内容已保存在当前浏览器，登录后会自动回到这里，重新勾选确认再点「提交」即可。
          </p>
          <a className="btn-primary btn-md" href={loginHref()} onClick={() => saveDraft()}>
            去登录 <ArrowRight size={16} />
          </a>
        </div>
      )}
      {submitError && (
        <div className="intake-submit-error" role="alert">
          <p>{submitError.message}</p>
        </div>
      )}
      <div className="consult-form-actions">
        <button type="submit" className="btn-primary btn-md" disabled={submitting || !requestKey}>
          {submitting ? "正在提交…" : submitError?.retry ? "重试提交" : "提交咨询"}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </div>
      <p role="status" aria-live="polite" className="intake-status">
        {notice}
      </p>
    </form>
  )
}
