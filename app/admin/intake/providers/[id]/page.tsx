import Link from "next/link"
import { notFound } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { isDbConfigured } from "@/lib/db"
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  DEPLOY_STATUS_LABELS,
  formatTime,
} from "@/lib/intake/constants"
import { adminGetApplication } from "@/lib/intake/store"
import { contactsOf, providerGroups, workFields } from "@/components/participation/intake-fields"
import { ContactList, EventList, KV, Notice, intakeUnavailable } from "@/components/admin/intake-shared"
import { DeploymentForm, IntakeFollowup } from "@/components/admin/intake-followup"

// 服务申请详情：资料、每个作品的附件与部署工单、审核表单、操作记录。
//
// 审核要点（发布门槛不因为表单简化而降低，§4.3）：开源署名、真实成果、本人贡献、使用限制、
// 公开授权缺一项就「需补充」。要公开展示，去「项目管理」新建项目录入审核后的内容，
// 不要把这份申请原样搬上去（里面有联系方式等私密信息）。
type PageProps = { params: Promise<{ id: string }> }

export default async function AdminIntakeProviderPage({ params }: PageProps) {
  if (!isDbConfigured()) return <Notice>本地未配置数据库，资料接收后台不可用。</Notice>
  const { id } = await params
  let r
  try {
    r = await adminGetApplication(id)
  } catch (err) {
    return intakeUnavailable(err)
  }
  if (!r) notFound()
  const me = await getCurrentUser()
  // 联系方式三项不逐个列，合成一行用 ContactList 显示（旧记录是 contactType + contact，也靠它显示）
  const fields = providerGroups.flatMap((g) => g.fields).filter((f) => !f.oneOf)

  return (
    <div className="space-y-6">
      <Link href="/admin/intake/providers" className="text-sm text-muted-foreground hover:text-foreground">
        ← 服务申请列表
      </Link>
      <div>
        <h2 className="text-xl font-semibold">{r.displayName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{r.id}</span> · 提交于 {formatTime(r.createdAt)} · {APPLICATION_STATUS_LABELS[r.status]} ·
          负责人：{r.assigneeName ?? "未指派"} · 版本 {r.version}
        </p>
      </div>

      <section className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium">基本资料</h3>
        <dl>
          {fields.map((f) => (
            <KV key={f.key} label={f.label} value={r.profile[f.key]} />
          ))}
          <div className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">联系方式</dt>
            <dd className="break-words">
              <ContactList contacts={contactsOf(r.profile)} />
            </dd>
          </div>
          <KV label="同意书版本" value={r.consentVersion} />
          <KV label="提交账号" value={r.ownerId} />
        </dl>
      </section>

      {r.works.map((w, i) => {
        const dep = r.deployments.find((d) => d.workIndex === i)
        return (
          <section key={i} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">
              作品 {i + 1}：{w.title}
            </h3>
            <dl>
              {workFields.map((f) =>
                f.key === "url" && typeof w.url === "string" ? (
                  <div key={f.key} className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="break-all">
                      {/* 外部链接：noopener + nofollow，不把后台页面的 referrer 带过去 */}
                      <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                        {w.url}
                      </a>
                    </dd>
                  </div>
                ) : (
                  <KV key={f.key} label={f.label} value={f.type === "check" ? (w[f.key] === "是" ? "已确认" : null) : w[f.key]} />
                ),
              )}
            </dl>
            {(w.assets ?? []).length > 0 && (
              <div className="text-sm">
                <p className="mb-1 text-muted-foreground">附件（私密，仅本人与管理员可打开）</p>
                <ul className="list-disc pl-5">
                  {(w.assets ?? []).map((aid) => (
                    <li key={aid}>
                      <a href={`/api/intake/assets/${aid}`} target="_blank" rel="noopener noreferrer" className="underline">
                        {r.assets[aid]?.name ?? aid}
                      </a>{" "}
                      <span className="text-muted-foreground">
                        {r.assets[aid] ? `${r.assets[aid].type} · ${(r.assets[aid].size / 1024 / 1024).toFixed(1)}MB` : "（附件记录缺失）"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dep && (
              <>
                <p className="text-sm">
                  部署：<b>{DEPLOY_STATUS_LABELS[dep.status]}</b>
                  {dep.publicUrl && ` · ${dep.publicUrl}`}
                </p>
                <DeploymentForm
                  applicationId={r.id}
                  workIndex={i}
                  version={dep.version}
                  status={dep.status}
                  publicUrl={dep.publicUrl}
                  failureSummary={dep.failureSummary}
                />
              </>
            )}
          </section>
        )
      })}

      <section className="space-y-2">
        <h3 className="font-medium">审核</h3>
        <p className="text-sm text-muted-foreground">
          「已发布」只是记录状态，不会自动出现在首页；公开作品请在「项目管理」录入审核后的内容并通过发布检查。
        </p>
        <IntakeFollowup
          endpoint={`/api/admin/intake/providers/${r.id}`}
          version={r.version}
          status={r.status}
          statuses={APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] }))}
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
