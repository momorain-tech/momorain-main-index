"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

// 删除是不可恢复操作，用浏览器原生 confirm 做二次确认——
// 管理后台只有自己人用，不值得为此引入一个模态框组件
export function DeleteProjectButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm(`确定删除「${name}」？此操作不可恢复。`)) return

    setDeleting(true)
    const res = await fetch(`/api/admin/projects/${slug}`, {
      method: "DELETE",
    }).catch(() => null)

    if (res?.ok) {
      // 列表是 Server Component，refresh 让它重新查库
      router.refresh()
      return
    }

    const data = res ? await res.json().catch(() => null) : null
    window.alert(data?.error ?? "删除失败，请重试")
    setDeleting(false)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
      disabled={deleting}
      onClick={handleDelete}
    >
      {deleting ? "删除中…" : "删除"}
    </Button>
  )
}
