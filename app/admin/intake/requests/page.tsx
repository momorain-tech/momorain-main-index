import Link from "next/link"

import { isDbConfigured } from "@/lib/db"
import {
  ANALYSIS_STATUS_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  formatTime,
  type RequestStatus,
} from "@/lib/intake/constants"
import { REQUEST_SEARCH_MAX } from "@/lib/intake/constants"
import { ADMIN_PAGE_SIZE, adminListRequests, adminPendingCounts, adminRequestStats } from "@/lib/intake/store"
import { CONTACT_TYPES } from "@/components/participation/intake-fields"
import { Stat } from "@/components/admin/charts"
import {
  IntakeTabs,
  ContactList,
  Notice,
  Pager,
  filtersQuery,
  intakeUnavailable,
  requestFilters,
} from "@/components/admin/intake-shared"

// 用户需求列表。layout 已做管理员守卫，并让页面每请求 SSR（总是最新数据）。
//
// 整页零客户端 JS：搜索和筛选是一个普通的 GET 表单，提交后地址变成
// ?q=…&status=…&contact=…，服务端按参数查库。好处是筛选结果可以直接复制链接给别人、
// 浏览器后退能回到上一次筛选，翻页链接也能原样带上这些参数。
// 列表里联系方式脱敏（用户填了几种就列几种），完整的点进详情看
type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const BASE = "/admin/intake/requests"
// 状态下拉框：五个具体状态之外，多一个「跟进中」分组，和顶部统计卡的口径一致
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "following", label: "跟进中（评估 / 沟通 / 等待补充）" },
  ...REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] })),
]
// 状态的小色块：待处理用醒目色，已关闭变灰，其余中性
const STATUS_TONE: Record<RequestStatus, string> = {
  received: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  reviewing: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  contacting: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  waiting_customer: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  closed: "bg-muted text-muted-foreground",
}
const field = "rounded-md border bg-background px-3 py-2 text-sm"

export default async function AdminIntakeRequestsPage({ searchParams }: PageProps) {
  if (!isDbConfigured()) return <Notice>本地未配置数据库，用户需求后台不可用。</Notice>
  const filters = requestFilters(await searchParams)
  const { q, status, contact: contactType, page } = filters
  const filtered = !!(q || status || contactType)

  let data, stats, counts
  try {
    ;[data, stats, counts] = await Promise.all([
      adminListRequests({ q, status, contactType, page }),
      adminRequestStats(),
      adminPendingCounts(),
    ])
  } catch (err) {
    return intakeUnavailable(err)
  }

  return (
    <div className="space-y-5">
      <IntakeTabs current="requests" counts={counts} />

      {/* 四个数不受下面的筛选影响。待处理 / 跟进中点进去就是对应的筛选 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="累计需求" value={stats.total} foot={`含已关闭 ${stats.closed} 条`} />
        <Link href={`${BASE}?status=received`} className="rounded-lg transition-colors hover:bg-muted/40">
          <Stat label="待处理" value={stats.pending} foot="已接收、还没开始跟进" />
        </Link>
        <Link href={`${BASE}?status=following`} className="rounded-lg transition-colors hover:bg-muted/40">
          <Stat label="跟进中" value={stats.following} foot="评估中 + 沟通中 + 等待对方补充" />
        </Link>
        <Stat label="提交用户数" value={stats.users} foot="提交过需求的不同账号" />
      </div>

      <form method="get" action={BASE} className="flex flex-wrap items-end gap-2" role="search">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
          关键词
          <input
            name="q"
            type="search"
            defaultValue={q}
            maxLength={REQUEST_SEARCH_MAX}
            placeholder="需求名称、问题、称呼、联系方式、公司、编号"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          状态
          <select name="status" defaultValue={status ?? ""} className={field}>
            <option value="">全部状态</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          留了哪种联系方式
          <select name="contact" defaultValue={contactType ?? ""} className={field}>
            <option value="">不限</option>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {/* 提交表单时 page 不在里面 → 换了筛选条件自动回到第一页 */}
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          筛选
        </button>
        {filtered && (
          <Link href={BASE} className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground">
            清除筛选
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground">
        {filtered ? `符合条件的需求 ${data.total} 条` : `全部需求 ${data.total} 条`}，最新提交的在前
      </p>

      {data.rows.length === 0 ? (
        page === 1 && <Notice>{filtered ? "没有符合条件的需求，换个关键词或清除筛选试试" : "暂无需求"}</Notice>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">需求</th>
                <th className="px-4 py-3 font-medium">联系人</th>
                <th className="px-4 py-3 font-medium">联系方式</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">负责人</th>
                <th className="px-4 py-3 font-medium">提交时间</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0 hover:bg-muted/30">
                  <td className="max-w-[22rem] px-4 py-3">
                    {/* 把当前筛选条件带进详情页，那边的「返回列表」才能回到同一页、同一个筛选结果 */}
                    <Link href={`${BASE}/${r.id}${filtersQuery(filters)}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    {/* 标题是用户没填时从问题里截的，这时摘要和标题重复，就不再显示 */}
                    {r.summary && !r.summary.startsWith(r.title) && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
                    )}
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{r.id}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{r.name || "—"}</td>
                  <td className="px-4 py-3">
                    <ContactList contacts={r.contacts} masked />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_TONE[r.status] ?? ""}`}>
                      {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {r.analysisStatus !== "not_requested" && (
                      <p className="mt-1 text-xs text-muted-foreground">AI：{ANALYSIS_STATUS_LABELS[r.analysisStatus]}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.assigneeName ?? "未指派"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base={BASE} page={page} total={data.total} size={ADMIN_PAGE_SIZE} query={{ q, status, contact: contactType }} />
    </div>
  )
}
