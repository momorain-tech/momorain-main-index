"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import type { AdminProject, ProjectCategory } from "@/lib/projects-admin"
import { Button } from "@/components/ui/button"

// 注意：从 lib/projects-admin 只 import 类型（编译后会被擦除）。
// 不能 import 它的值——那个模块引用了 mysql2，进不了浏览器打包
const CATEGORY_OPTIONS: { value: ProjectCategory; label: string }[] = [
  { value: "recommended", label: "猜你喜欢（recommended）" },
  { value: "trending", label: "当前最热（trending）" },
  { value: "starred", label: "用户收藏（starred）" },
]

// 与 shadcn/ui Input 组件一致的样式；表单控件不多，直接复用类名，
// 等以后别处也要用输入框时再抽成 components/ui/input.tsx
const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// 表单内部状态全部用字符串（input 的 value 本来就是字符串），
// 提交时再转换成 API 需要的类型（tags 拆数组、sortOrder 转数字）
type FormState = {
  slug: string
  icon: string
  name: string
  desc: string
  longDesc: string
  tags: string
  link: string
  demo: string
  category: ProjectCategory
  sortOrder: string
}

// 不传 initial = 新建，传 initial = 编辑现有项目
export function ProjectForm({ initial }: { initial?: AdminProject }) {
  const router = useRouter()
  const isEdit = initial !== undefined

  const [form, setForm] = useState<FormState>({
    slug: initial?.slug ?? "",
    icon: initial?.icon ?? "",
    name: initial?.name ?? "",
    desc: initial?.desc ?? "",
    longDesc: initial?.longDesc ?? "",
    tags: initial?.tags.join(", ") ?? "",
    link: initial?.link ?? "",
    demo: initial?.demo ?? "",
    category: initial?.category ?? "recommended",
    sortOrder: String(initial?.sortOrder ?? 0),
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      // slug 是主键，编辑时不提交（也改不了），创建时才带上
      ...(isEdit ? {} : { slug: form.slug.trim() }),
      icon: form.icon.trim(),
      name: form.name.trim(),
      desc: form.desc.trim(),
      longDesc: form.longDesc.trim(),
      // 中英文逗号都认，空片段过滤掉
      tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      link: form.link.trim(),
      demo: form.demo.trim(),
      category: form.category,
      sortOrder: Number(form.sortOrder),
    }

    const res = await fetch(
      isEdit ? `/api/admin/projects/${initial.slug}` : "/api/admin/projects",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ).catch(() => null)

    if (res?.ok) {
      router.push("/admin/projects")
      // push 只是导航，refresh 才会让列表页的 Server Component 重新查库
      router.refresh()
      return
    }

    const data = res ? await res.json().catch(() => null) : null
    setError(data?.error ?? "保存失败，请检查网络后重试")
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <Field label="slug" hint="项目的 URL 标识（如 my-project），小写字母、数字、中划线；创建后不可修改">
        <input
          className={`${inputClass} font-mono`}
          value={form.slug}
          onChange={(e) => update("slug", e.target.value)}
          disabled={isEdit}
          required={!isEdit}
          placeholder="my-project"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[100px_1fr]">
        <Field label="图标" hint="一个 emoji">
          <input
            className={inputClass}
            value={form.icon}
            onChange={(e) => update("icon", e.target.value)}
            required
            placeholder="🌊"
          />
        </Field>
        <Field label="名称">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            placeholder="RainFlow"
          />
        </Field>
      </div>

      <Field label="简介" hint="显示在首页列表里的一句话介绍">
        <input
          className={inputClass}
          value={form.desc}
          onChange={(e) => update("desc", e.target.value)}
          required
        />
      </Field>

      <Field label="详细介绍" hint="显示在项目详情页">
        <textarea
          className={`${inputClass} h-32 resize-y py-2`}
          value={form.longDesc}
          onChange={(e) => update("longDesc", e.target.value)}
          required
        />
      </Field>

      <Field label="标签" hint="逗号分隔，如：React, 状态管理, TypeScript">
        <input
          className={inputClass}
          value={form.tags}
          onChange={(e) => update("tags", e.target.value)}
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="项目链接（可选）">
          <input
            className={inputClass}
            type="url"
            value={form.link}
            onChange={(e) => update("link", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Demo 链接（可选）">
          <input
            className={inputClass}
            type="url"
            value={form.demo}
            onChange={(e) => update("demo", e.target.value)}
            placeholder="https://…"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="首页分区">
          <select
            className={inputClass}
            value={form.category}
            onChange={(e) => update("category", e.target.value as ProjectCategory)}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="分区内排序" hint="0-255，数字小的排前面">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={255}
            value={form.sortOrder}
            onChange={(e) => update("sortOrder", e.target.value)}
            required
          />
        </Field>
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : isEdit ? "保存修改" : "创建项目"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
