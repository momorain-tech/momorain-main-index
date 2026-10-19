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
import { CONTACT_GROUP, consultFields, contactsOf, demandGroups } from "@/components/participation/intake-fields"
import { AnalysisBlock } from "@/components/participation/receipt-view"
import {
  ContactList,
  EventList,
  KV,
  Notice,
  filtersQuery,
  intakeUnavailable,
  requestFilters,
} from "@/components/admin/intake-shared"
import { IntakeFollowup, RequeueAnalysisButton } from "@/components/admin/intake-followup"

// 需求详情，按「需求内容 → 联系资料 → 跟进」分区，下面是 AI 初评和操作记录。
// 联系方式在这里显示完整值（列表里是脱敏的）。地址栏里带着列表页的筛选条件，只用来拼「返回列表」
type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminIntakeRequestPage({ params, searchParams }: PageProps) {
  if (!isDbConfigured()) return <Notice>本地未配置数据库，用户需求后台不可用。</Notice>
  const { id } = await params
  const back = `/admin/intake/requests${filtersQuery(requestFilters(await searchParams))}`
  let r
  try {
    r = await adminGetRequest(id)
  } catch (err) {
    return intakeUnavailable(err)
  }
  if (!r) notFound()
  const me = await getCurrentUser()
  // 第一步的字段 = 需求内容，第二步的字段 = 称呼和联系方式（见 intake-fields.ts 的 demandGroups）。
  // 轻量咨询（第四版首页）只有场景、进度、补充说明三项，联系方式下面统一显示
  const isConsult = r.kind === "consult"
  const contentFields = isConsult ? consultFields.filter((f) => f.oneOf !== CONTACT_GROUP) : demandGroups[0].fields
  const a = r.analysis
  const canRequeue = !isConsult && !!aiConfig() && !["queued", "running"].includes(a.status)

  return (
    <div className="space-y-6">
      <Link href={back} className="text-sm text-muted-foreground hover:text-foreground">
        ← 返回需求列表
      </Link>
      <div>
        <h2 className="text-xl font-semibold">{r.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{r.id}</span> · 提交于 {formatTime(r.createdAt)} · {REQUEST_STATUS_LABELS[r.status]} · 负责人：
          {r.assigneeName ?? "未指派"} · 版本 {r.version}
        </p>
      </div>

      <section className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium">{isConsult ? "咨询内容（轻量咨询）" : "需求内容"}</h3>
        {isConsult && (
          <p className="mb-2 text-xs text-muted-foreground">
            访客从首页场景发起的简短咨询，没有填写具体问题和期望结果。联系时先了解现状，再看是否需要整理成完整需求。
          </p>
        )}
        <dl>
          {contentFields.map((f) => (
            <KV key={f.key} label={f.label} value={r.values[f.key]} />
          ))}
          <KV label="参考作品" value={r.reference ? `${r.reference.name}（${r.reference.slug}）${r.reference.provider ? ` · ${r.reference.provider}` : ""}` : null} />
        </dl>
      </section>

      <section className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium">联系资料</h3>
        <dl>
          {!isConsult && <KV label="称呼" value={r.values.name} />}
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">联系方式</dt>
            <dd className="break-words">
              <ContactList contacts={contactsOf(r.values)} />
            </dd>
          </div>
          <KV label="提交账号" value={r.ownerId} />
          <KV
            label="同意书版本"
            value={isConsult ? r.consentVersion : `${r.consentVersion}${r.analysisConsent ? " · 同意 AI 初评" : " · 未同意 AI 初评"}`}
          />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          用户留了哪几种就可以用哪几种联系。这些是用户自己填的，和登录手机号无关；完整联系方式只在这一页显示，不要转发到群里。
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">跟进</h3>
        <p className="text-xs text-muted-foreground">负责人、状态、给用户的说明（用户在进度页能看到）和内部备注，一次保存。</p>
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

      {!isConsult && <section className="rounded-lg border p-4">
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
      </section>}

      <section className="space-y-2">
        <h3 className="font-medium">操作记录</h3>
        <EventList events={r.events} />
      </section>
    </div>
  )
}
