import Link from "next/link"

import { isDbConfigured } from "@/lib/db"
import {
  ANALYSIS_STATUS_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  formatTime,
  maskContact,
} from "@/lib/intake/constants"
import { ADMIN_PAGE_SIZE, adminListRequests, adminPendingCounts } from "@/lib/intake/store"
import { IntakeTabs, Notice, Pager, StatusFilter, intakeUnavailable, pageParam } from "@/components/admin/intake-shared"

// 需求接收队列。layout 已做管理员守卫，并让页面每请求 SSR（总是最新数据）。
// 列表里联系方式脱敏，完整的点进详情看（§5.2）
type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AdminIntakeRequestsPage({ searchParams }: PageProps) {
  if (!isDbConfigured()) return <Notice>本地未配置数据库，资料接收后台不可用。</Notice>
  const sp = await searchParams
  const status = typeof sp.status === "string" ? sp.status : undefined
  const page = pageParam(sp.page)
  let data, counts
  try {
    ;[data, counts] = await Promise.all([adminListRequests({ status, page }), adminPendingCounts()])
  } catch (err) {
    return intakeUnavailable(err)
  }
  return (
    <div className="space-y-4">
      <IntakeTabs current="requests" counts={counts} />
      <StatusFilter
        base="/admin/intake/requests"
        current={status}
        options={REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] }))}
      />
      {data.rows.length === 0 ? (
        <Notice>暂无需求</Notice>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">需求</th>
                <th className="px-4 py-3 font-medium">联系人</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">AI 初评</th>
                <th className="px-4 py-3 font-medium">负责人</th>
                <th className="px-4 py-3 font-medium">提交时间</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/intake/requests/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{r.id}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.name}
                    <p className="text-xs text-muted-foreground">
                      {r.contactType} {maskContact(r.contact)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{REQUEST_STATUS_LABELS[r.status]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ANALYSIS_STATUS_LABELS[r.analysisStatus]}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.assigneeName ?? "未指派"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/intake/requests" page={page} total={data.total} size={ADMIN_PAGE_SIZE} status={status} />
    </div>
  )
}
