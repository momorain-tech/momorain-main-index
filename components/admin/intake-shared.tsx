import Link from "next/link"

import { formatTime } from "@/lib/intake/constants"
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
      {tab("/admin/intake/requests", `需求${counts ? `（待处理 ${counts.requests}）` : ""}`, current === "requests")}
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

export function Pager({ base, page, total, size, status }: { base: string; page: number; total: number; size: number; status?: string }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return null
  const href = (p: number) => `${base}?page=${p}${status ? `&status=${status}` : ""}`
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

export function pageParam(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return Number.isInteger(n) && n > 0 && n < 10000 ? n : 1
}
