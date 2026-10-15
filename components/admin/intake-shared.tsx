import Link from "next/link"

import {
  REQUEST_SEARCH_MAX,
  REQUEST_STATUSES,
  formatTime,
  maskContact,
  type RequestStatus,
} from "@/lib/intake/constants"
import { isContactType, type ContactEntry } from "@/components/participation/intake-fields"
import type { IntakeEvent } from "@/lib/intake/store"

// 后台资料接收几页共用的小块：顶部切换、空状态 / 出错提示、操作记录、分页。纯服务端组件

export function IntakeTabs({ current, counts }: { current: "requests" | "providers"; counts?: { requests: number; applications: number } }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm ${on ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </Link>
  )
  return (
    <div className="mb-4 flex gap-2">
      {tab("/admin/intake/requests", `用户需求${counts ? `（待处理 ${counts.requests}）` : ""}`, current === "requests")}
      {tab("/admin/intake/providers", `服务申请${counts ? `（待审核 ${counts.applications}）` : ""}`, current === "providers")}
    </div>
  )
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
}

// 数据库没配 / 迁移 005 没跑：给出明确原因，而不是一个 500 页面
export function intakeUnavailable(err: unknown) {
  const code = (err as { code?: string })?.code
  if (code === "ER_NO_SUCH_TABLE")
    return <Notice>资料接收的数据表还没建：请先在服务器执行 migrations/005_intake.sql（执行前备份）。</Notice>
  throw err
}

export function EventList({ events }: { events: IntakeEvent[] }) {
  const labels: Record<string, string> = {
    received: "接收",
    status: "状态",
    assign: "指派",
    note: "内部备注",
    customer_note: "给对方的说明",
    analysis: "AI 初评",
    deployment: "部署",
  }
  if (!events.length) return <p className="text-sm text-muted-foreground">暂无记录</p>
  return (
    <ol className="space-y-2 text-sm">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 pl-3">
          <div className="text-xs text-muted-foreground">
            {formatTime(e.createdAt)} · {labels[e.eventType] ?? e.eventType} · {e.actorName ?? "系统"}
          </div>
          {e.note && <div className="whitespace-pre-wrap">{e.note}</div>}
        </li>
      ))}
    </ol>
  )
}

// 把筛选条件拼成 ?a=1&b=2，空值不出现。URLSearchParams 负责转义（关键词里可能有 & # 空格、中文）
export function queryString(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ""
}

// 翻页链接带上当前全部筛选条件（query），否则点「下一页」会掉回未筛选的列表
export function Pager({
  base,
  page,
  total,
  size,
  query = {},
}: {
  base: string
  page: number
  total: number
  size: number
  query?: Record<string, string | undefined>
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  const href = (p: number) => `${base}${queryString({ ...query, page: p > 1 ? p : undefined })}`
  // 手改地址栏翻到了不存在的页（或者筛选后条数变少了）：给一个回第一页的出口
  if (page > pages)
    return (
      <p className="text-sm text-muted-foreground">
        第 {page} 页没有内容（共 {total} 条）。<Link href={href(1)} className="underline">回到第一页</Link>
      </p>
    )
  if (pages <= 1) return null
  return (
    <div className="flex items-center gap-3 text-sm">
      {page > 1 && <Link href={href(page - 1)}>← 上一页</Link>}
      <span className="text-muted-foreground">
        第 {page} / {pages} 页（共 {total} 条）
      </span>
      {page < pages && <Link href={href(page + 1)}>下一页 →</Link>}
    </div>
  )
}

export function StatusFilter({ base, current, options }: { base: string; current?: string; options: { value: string; label: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-sm">
      <Link href={base} className={!current ? "font-medium" : "text-muted-foreground hover:text-foreground"}>
        全部
      </Link>
      {options.map((o) => (
        <Link
          key={o.value}
          href={`${base}?status=${o.value}`}
          className={current === o.value ? "font-medium" : "text-muted-foreground hover:text-foreground"}
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}

export function KV({ label, value }: { label: string; value?: string | string[] | null }) {
  if (!value || (Array.isArray(value) && !value.length)) return null
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{Array.isArray(value) ? value.join("、") : value}</dd>
    </div>
  )
}

// searchParams 里同名参数出现多次时是数组（?q=a&q=b），只取第一个
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export function pageParam(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return Number.isInteger(n) && n > 0 && n < 10000 ? n : 1
}

// 需求列表的筛选条件，从地址栏解析。列表页和详情页（「返回列表」要回到同一个筛选结果）共用。
// 地址栏里的参数谁都能改：只有认识的值才生效，其余当作没传
export type RequestFilters = { q?: string; status?: string; contact?: string; page: number }
export function requestFilters(sp: Record<string, string | string[] | undefined>): RequestFilters {
  const q = firstParam(sp.q)?.trim().slice(0, REQUEST_SEARCH_MAX) || undefined
  const status = firstParam(sp.status)
  const contact = firstParam(sp.contact)
  return {
    q,
    status: status === "following" || REQUEST_STATUSES.includes(status as RequestStatus) ? status : undefined,
    contact: isContactType(contact) ? contact : undefined,
    page: pageParam(sp.page),
  }
}
// 筛选条件 → 地址栏参数（第一页不写 page，地址短一点）
export function filtersQuery(f: RequestFilters) {
  return queryString({ q: f.q, status: f.status, contact: f.contact, page: f.page > 1 ? f.page : undefined })
}

// 一条记录留下的联系方式，一行一种。
// masked：列表页用，只露头尾；详情页显示完整值——电话、邮箱做成 tel: / mailto: 链接（电脑上会唤起
// 拨号 / 邮件软件），微信号用 select-all，点一下就整段选中方便复制
export function ContactList({ contacts, masked = false }: { contacts: ContactEntry[]; masked?: boolean }) {
  if (!contacts.length) return <span className="text-muted-foreground">—</span>
  return (
    <ul className="space-y-0.5">
      {contacts.map((c) => (
        <li key={c.type} className="whitespace-nowrap">
          <span className="text-muted-foreground">{c.type} </span>
          {masked ? (
            <span className="text-xs">{maskContact(c.value)}</span>
          ) : c.type === "电话" ? (
            // 分机号（「转 802」「ext.12」）不能拼进 tel: 链接，否则拨出去是一串错号
            <a className="font-mono underline" href={`tel:${c.value.split(/转|ext|x|#/i)[0].replace(/[^\d+]/g, "")}`}>
              {c.value}
            </a>
          ) : c.type === "邮箱" ? (
            <a className="font-mono underline" href={`mailto:${c.value}`}>
              {c.value}
            </a>
          ) : (
            <span className="select-all font-mono">{c.value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
