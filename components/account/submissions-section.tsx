"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  APPLICATION_STATUS_PUBLIC,
  REQUEST_STATUS_PUBLIC,
  formatTime,
  type ApplicationStatus,
  type RequestStatus,
} from "@/lib/intake/constants"

// 账号页「我的提交」：当前账号提交过的需求和服务资料，点进去看进度。
// 接口挂了不影响账号页其余部分（只在这一块显示错误）

type Item = { kind: "request" | "application"; id: string; title: string; status: string; createdAt: string }

export function SubmissionsSection({ onNeedLogin }: { onNeedLogin: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch("/api/intake/mine", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) return onNeedLogin()
        if (!res.ok) throw new Error(String(res.status))
        const data: { items: Item[] } = await res.json()
        if (!cancelled) setItems(data.items)
      })
      .catch(() => !cancelled && setError("暂时读取不到提交记录，请稍后刷新"))
    return () => {
      cancelled = true
    }
  }, [onNeedLogin])

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">我的提交</h2>
        <p className="text-sm text-muted-foreground">在 AI有活 提交的需求和服务资料，点击查看跟进进度</p>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {!error && items === null && <div className="h-16 animate-pulse rounded-md bg-muted" />}
      {items?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          还没有提交过。<Link href="/requests/new" className="underline">提交需求</Link> 或{" "}
          <Link href="/providers/join" className="underline">提交服务资料</Link>
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.kind === "request" ? `/my/requests/${it.id}` : `/my/applications/${it.id}`}
                className="flex flex-col gap-0.5 py-3 hover:opacity-80"
              >
                <span className="text-sm font-medium">
                  <span className="mr-2 text-xs text-muted-foreground">{it.kind === "request" ? "需求" : "服务资料"}</span>
                  {it.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {it.kind === "request"
                    ? REQUEST_STATUS_PUBLIC[it.status as RequestStatus]
                    : APPLICATION_STATUS_PUBLIC[it.status as ApplicationStatus]}{" "}
                  · {formatTime(it.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
