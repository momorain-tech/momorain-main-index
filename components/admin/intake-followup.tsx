"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { DEPLOY_STATUSES, DEPLOY_STATUS_LABELS, type DeployStatus } from "@/lib/intake/constants"

// 后台资料接收的三个交互件：跟进表单、部署工单、重新安排 AI 初评。
// 都是「发请求 → 成功就 router.refresh() 重新拉服务端数据」，不在客户端自己拼新状态——
// 服务端页面才是唯一的真相，避免两边显示不一致。

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm"

// 跟进 / 审核表单。需求和服务申请共用，区别只在接口地址和状态选项
export function IntakeFollowup({
  endpoint,
  version,
  status,
  statuses,
  customerNote,
  assignedToMe,
  hasAssignee,
}: {
  endpoint: string
  version: number
  status: string
  statuses: { value: string; label: string }[]
  customerNote: string
  assignedToMe: boolean
  hasAssignee: boolean
}) {
  const router = useRouter()
  const [nextStatus, setNextStatus] = useState(status)
  const [note, setNote] = useState("")
  const [toCustomer, setToCustomer] = useState(customerNote)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true)
    setMessage("")
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: version, status: nextStatus, customerNote: toCustomer, note, ...extra }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setNote("")
      setMessage("已保存")
      router.refresh()
      return
    }
    const data = res ? await res.json().catch(() => null) : null
    // 404 多半是登录过期（后台接口对非管理员一律 404）
    setMessage(data?.error ?? (res?.status === 404 ? "保存失败：登录可能已过期，请刷新" : "保存失败，请重试"))
  }

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium" htmlFor="followup-status">
          状态
        </label>
        <select id="followup-status" className={`${field} w-auto`} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        {assignedToMe ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => save({ assign: "none" })}>
            取消指派
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => save({ assign: "me" })}>
            {hasAssignee ? "改为由我负责" : "由我负责"}
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="followup-customer">
          给对方的说明（对方在进度页能看到，比如需要补充什么）
        </label>
        <textarea id="followup-customer" className={field} rows={2} maxLength={1000} value={toCustomer} onChange={(e) => setToCustomer(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="followup-note">
          内部备注（只有后台可见，会记进操作记录）
        </label>
        <textarea id="followup-note" className={field} rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {message}
        </span>
      </div>
    </form>
  )
}

export function RequeueAnalysisButton({ requestId, label }: { requestId: string; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function run() {
    if (!window.confirm("会再调用一次模型（由平台账号付费）。确定吗？")) return
    setBusy(true)
    const res = await fetch(`/api/admin/intake/requests/${requestId}/analysis`, { method: "POST" }).catch(() => null)
    setBusy(false)
    if (res?.ok) return router.refresh()
    const data = res ? await res.json().catch(() => null) : null
    window.alert(data?.error ?? "操作失败，请重试")
  }
  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={run}>
      {busy ? "处理中…" : label}
    </Button>
  )
}

export function DeploymentForm({
  applicationId,
  workIndex,
  version,
  status,
  publicUrl,
  failureSummary,
}: {
  applicationId: string
  workIndex: number
  version: number
  status: DeployStatus
  publicUrl: string | null
  failureSummary: string | null
}) {
  const router = useRouter()
  const [s, setS] = useState<string>(status)
  const [url, setUrl] = useState(publicUrl ?? "")
  const [summary, setSummary] = useState(failureSummary ?? "")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function save() {
    setBusy(true)
    setMessage("")
    const res = await fetch(`/api/admin/intake/providers/${applicationId}/deployments/${workIndex}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: version, status: s, publicUrl: url, failureSummary: summary }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setMessage("已保存")
      return router.refresh()
    }
    const data = res ? await res.json().catch(() => null) : null
    setMessage(data?.error ?? "保存失败，请重试")
  }
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">
        部署工单（人工）：只有部署在独立展示域名、实际打开验证过之后才标「已上线」，申请人那边才会出现「打开 Demo」。
      </p>
      <div className="flex flex-wrap gap-2">
        <select className={`${field} w-auto`} value={s} onChange={(e) => setS(e.target.value)} aria-label="部署状态">
          {DEPLOY_STATUSES.map((d) => (
            <option key={d} value={d}>
              {DEPLOY_STATUS_LABELS[d]}
            </option>
          ))}
        </select>
        <input className={`${field} min-w-[16rem] flex-1`} placeholder="https://<独立展示域名>/d/<demoId>/<version>/" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="访问地址" />
      </div>
      <input className={field} placeholder="失败原因 / 备注（申请人可见，500 字内）" value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} aria-label="失败原因" />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={save}>
          {busy ? "保存中…" : "更新部署状态"}
        </Button>
        <span className="text-sm text-muted-foreground" role="status">
          {message}
        </span>
      </div>
    </div>
  )
}
