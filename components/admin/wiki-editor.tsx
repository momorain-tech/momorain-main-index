"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

// 与 project-form.tsx 相同的输入框样式（那边有说明为什么暂不抽成 ui/input）
const inputClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// 查看/编辑二态的 Wiki 编辑器。
// 为什么不直接放进 ProjectForm：wiki 往往是长文档（部署步骤、命令清单），
// 塞进项目表单里既挤，又会让"改个排序"也得连带提交整篇文档
export function WikiEditor({
  slug,
  initialWiki,
}: {
  slug: string
  initialWiki: string
}) {
  // 两份状态的分工：wiki 是"已保存的内容"，draft 是"编辑中的草稿"——
  // 分开存，点「取消」才能扔掉草稿、回到上次保存的样子
  const [wiki, setWiki] = useState(initialWiki)
  const [draft, setDraft] = useState(initialWiki)
  // 还没写过 wiki 时直接进入编辑态，省一次点击
  const [editing, setEditing] = useState(initialWiki === "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    setSaving(true)

    const res = await fetch(`/api/admin/projects/${slug}/wiki`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wiki: draft }),
    }).catch(() => null)

    if (res?.ok) {
      setWiki(draft)
      setEditing(false)
      setSaving(false)
      return
    }

    const data = res ? await res.json().catch(() => null) : null
    setError(data?.error ?? "保存失败，请检查网络后重试")
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <textarea
          className={`${inputClass} h-96 resize-y font-mono leading-relaxed`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={"记录这个项目的内部信息，例如：\n\n## 如何部署\n1. ssh 到服务器\n2. git pull && pnpm build\n3. pm2 restart xxx"}
          autoFocus
        />
        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setDraft(wiki) // 扔掉草稿，回到已保存的内容
              setError(null)
              setEditing(false)
            }}
          >
            取消
          </Button>
        </div>
      </div>
    )
  }

  // 查看态。没有内容时给一个空状态，避免出现一块神秘的空白
  if (wiki === "") {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          还没有 Wiki 内容
        </p>
        <Button onClick={() => setEditing(true)}>开始记录</Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* whitespace-pre-wrap 保留换行和缩进（TEXT 里存的是纯文本），
          等宽字体让命令、路径这类内容对齐易读 */}
      <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
        {wiki}
      </div>
      <Button variant="outline" onClick={() => setEditing(true)}>
        编辑
      </Button>
    </div>
  )
}
