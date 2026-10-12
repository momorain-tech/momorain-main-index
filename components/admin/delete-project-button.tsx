"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

// 删除是不可恢复操作（案例内容、wiki 一起没了）。平时要下线一个项目应该用「撤下」，
// 所以这里的确认故意做得麻烦一点：要手动输入 slug 才删（§8.3「增加明确确认」）。
// 用浏览器原生 prompt——管理后台只有自己人用，不值得为此引入一个模态框组件
export function DeleteProjectButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const typed = window.prompt(
      `删除「${name}」不可恢复，内容和 wiki 会一起删掉。\n只是想让它从前台消失的话，请用「撤下」。\n\n确定要删除，请输入 slug：${slug}`
    )
    if (typed === null) return
    if (typed.trim() !== slug) {
      window.alert("输入的 slug 不一致，没有删除")
      return
    }

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
