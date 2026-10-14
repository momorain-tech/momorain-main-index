import Link from "next/link"
import { notFound } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { isDbConfigured } from "@/lib/db"
import { aiConfig } from "@/lib/intake/analysis"
import {
  ANALYSIS_STATUS_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  formatTime,
} from "@/lib/intake/constants"
import { adminGetRequest } from "@/lib/intake/store"
import { demandGroups } from "@/components/participation/intake-fields"
import { AnalysisBlock } from "@/components/participation/receipt-view"
import { EventList, KV, Notice, intakeUnavailable } from "@/components/admin/intake-shared"
import { IntakeFollowup, RequeueAnalysisButton } from "@/components/admin/intake-followup"

// 需求详情：完整资料（含联系方式）、AI 初评、跟进表单、操作记录
type PageProps = { params: Promise<{ id: string }> }

export default async function AdminIntakeRequestPage({ params }: PageProps) {
  if (!isDbConfigured()) return <Notice>本地未配置数据库，资料接收后台不可用。</Notice>
  const { id } = await params
  let r
  try {
    r = await adminGetRequest(id)
  } catch (err) {
    return intakeUnavailable(err)
  }
  if (!r) notFound()
  const me = await getCurrentUser()
  const fields = demandGroups.flatMap((g) => g.fields)
  const a = r.analysis
  const canRequeue = !!aiConfig() && !["queued", "running"].includes(a.status)

  return (
    <div className="space-y-6">
      <Link href="/admin/intake/requests" className="text-sm text-muted-foreground hover:text-foreground">
        ← 需求列表
      </Link>
      <div>
        <h2 className="text-xl font-semibold">{r.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{r.id}</span> · 提交于 {formatTime(r.createdAt)} · {REQUEST_STATUS_LABELS[r.status]} · 负责人：
          {r.assigneeName ?? "未指派"} · 版本 {r.version}
        </p>
      </div>

      <section className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium">需求资料</h3>
        <dl>
          {fields.map((f) => (
            <KV key={f.key} label={f.label} value={r.values[f.key]} />
          ))}
          <KV label="参考作品" value={r.reference ? `${r.reference.name}（${r.reference.slug}）${r.reference.provider ? ` · ${r.reference.provider}` : ""}` : null} />
          <KV label="同意书版本" value={`${r.consentVersion}${r.analysisConsent ? " · 同意 AI 初评" : " · 未同意 AI 初评"}`} />
          <KV label="提交账号" value={r.ownerId} />
        </dl>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="font-medium">AI 初评</h3>
          <span className="text-sm text-muted-foreground">
            {ANALYSIS_STATUS_LABELS[a.status]}
            {a.errorCode && `（${a.errorCode}）`}
          </span>
          <span className="flex-1" />
          {canRequeue && (
            <RequeueAnalysisButton requestId={r.id} label={a.status === "succeeded" ? "重新分析" : "安排 AI 初评"} />
          )}
        </div>
        {!aiConfig() && (
          <p className="text-sm text-muted-foreground">
            未配置模型（INTAKE_AI_BASE_URL / INTAKE_AI_KEY / INTAKE_AI_MODEL），请人工评估。
          </p>
        )}
        {a.status === "needs_review" && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            上次调用超时或中断，结果未知，可能已经计费。先到 one-api 的用量明细核对，再决定是否重新分析。
          </p>
        )}
        {a.result && <AnalysisBlock result={a.result} />}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">跟进</h3>
        <IntakeFollowup
          endpoint={`/api/admin/intake/requests/${r.id}`}
          version={r.version}
          status={r.status}
          statuses={REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] }))}
          customerNote={r.customerNote ?? ""}
          assignedToMe={!!me && r.assigneeId === me.userId}
          hasAssignee={!!r.assigneeId}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">操作记录</h3>
        <EventList events={r.events} />
      </section>
    </div>
  )
}
