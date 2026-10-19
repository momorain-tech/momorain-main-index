import Link from "next/link"

import { isDbConfigured } from "@/lib/db"
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, formatTime } from "@/lib/intake/constants"
import { ADMIN_PAGE_SIZE, adminListApplications, adminPendingCounts } from "@/lib/intake/store"
import { ContactList, IntakeTabs, Notice, Pager, StatusFilter, intakeUnavailable, pageParam } from "@/components/admin/intake-shared"

// 服务申请审核队列。审核通过 ≠ 自动公开：公开作品仍在「项目管理」里录入并过发布检查
type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function AdminIntakeProvidersPage({ searchParams }: PageProps) {
  if (!isDbConfigured()) return <Notice>本地未配置数据库，资料接收后台不可用。</Notice>
  const sp = await searchParams
  const status = typeof sp.status === "string" ? sp.status : undefined
  const page = pageParam(sp.page)
  let data, counts
  try {
    ;[data, counts] = await Promise.all([adminListApplications({ status, page }), adminPendingCounts()])
  } catch (err) {
    return intakeUnavailable(err)
  }
  return (
    <div className="space-y-4">
      <IntakeTabs current="providers" counts={counts} />
      <StatusFilter
        base="/admin/intake/providers"
        current={status}
        options={APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] }))}
      />
      {data.rows.length === 0 ? (
        <Notice>暂无服务申请</Notice>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">服务方</th>
                <th className="px-4 py-3 font-medium">联系人</th>
                <th className="px-4 py-3 font-medium">作品数</th>
                <th className="px-4 py-3 font-medium">审核状态</th>
                <th className="px-4 py-3 font-medium">负责人</th>
                <th className="px-4 py-3 font-medium">提交时间</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/intake/providers/${r.id}`} className="font-medium hover:underline">
                      {r.displayName}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{r.id}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.name}
                    <div className="mt-0.5 text-xs">
                      <ContactList contacts={r.contacts} masked />
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.works}</td>
                  <td className="whitespace-nowrap px-4 py-3">{APPLICATION_STATUS_LABELS[r.status]}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.assigneeName ?? "未指派"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/intake/providers" page={page} total={data.total} size={ADMIN_PAGE_SIZE} query={{ status }} />
    </div>
  )
}
