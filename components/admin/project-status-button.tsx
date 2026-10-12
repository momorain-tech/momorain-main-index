"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

// 列表页上的一键状态切换。走 PATCH，只改状态不碰内容（见 lib/projects-admin.ts 的 updateProjectStatus）
const ACTIONS = {
  publish: { label: "发布", confirm: "发布后首页和详情页会立即显示这个项目。确定吗？" },
  unpublish: { label: "撤下", confirm: "撤下后首页列表和详情页都会立即消失（内容保留，可以再发布）。确定吗？" },
  "stop-trial": {
    label: "撤下试用",
    confirm: "改成「成果演示」：项目仍然公开，但不再显示「立即体验」按钮。确定吗？",
  },
} as const

export function ProjectStatusButton({
  slug,
  action,
}: {
  slug: string
  action: keyof typeof ACTIONS
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { label, confirm } = ACTIONS[action]

  async function run() {
    if (!window.confirm(confirm)) return
    setBusy(true)
    const res = await fetch(`/api/admin/projects/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      router.refresh()
      return
    }
    const data = res ? await res.json().catch(() => null) : null
    const missing: string[] = Array.isArray(data?.missing) ? data.missing : []
    window.alert(
      (data?.error ?? "操作失败，请重试") + (missing.length ? `\n\n缺：\n· ${missing.join("\n· ")}` : "")
    )
  }

  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={run}>
      {busy ? "处理中…" : label}
    </Button>
  )
}
