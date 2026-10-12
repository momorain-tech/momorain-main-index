"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import type { AdminProject, ProjectCategory } from "@/lib/projects-admin"
// project-content 是纯函数模块（没有 mysql2），可以 import 值进浏览器
import {
  MATURITIES,
  MATURITY_LABELS,
  OUTPUT_KINDS,
  OUTPUT_KIND_LABELS,
  OUTPUT_TYPES,
  OWNERSHIPS,
  OWNERSHIP_LABELS,
  checkPublish,
  type CaseContent,
  type CaseOutput,
  type Maturity,
  type OutputKind,
  type OutputType,
  type Ownership,
} from "@/lib/project-content"
import { Button } from "@/components/ui/button"

// 注意：从 lib/projects-admin 只 import 类型（编译后会被擦除）。
// 不能 import 它的值——那个模块引用了 mysql2，进不了浏览器打包
const CATEGORY_OPTIONS: { value: ProjectCategory; label: string }[] = [
  { value: "recommended", label: "第 1 组（recommended）" },
  { value: "trending", label: "第 2 组（trending）" },
  { value: "starred", label: "第 3 组（starred）" },
]

// 与 shadcn/ui Input 组件一致的样式；表单控件不多，直接复用类名，
// 等以后别处也要用输入框时再抽成 components/ui/input.tsx
const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
const textareaClass = `${inputClass} h-24 resize-y py-2`

// 表单内部状态全部用字符串（input 的 value 本来就是字符串），
// 提交时再转换成 API 需要的类型（tags 拆数组、sortOrder 转数字、多行文字拆列表）
type OutputState = {
  type: OutputType
  kind: OutputKind
  url: string
  caption: string
  source: string
  poster: string
}

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
  ownership: Ownership | ""
  maturity: Maturity | ""
  featured: boolean
  coverUrl: string
  coverAlt: string
  coverWidth: string
  coverHeight: string
  // 案例内容：文字段
  audience: string
  scenario: string
  problem: string
  role: string
  input: string
  dataFlow: string
  // 列表段：textarea 里一行一项
  steps: string
  customization: string
  deliverables: string
  excluded: string
  limits: string
  contribSelf: string
  contribOpenSource: string
  contribThirdParty: string
  goalUsable: string
  goalDeployable: string
  goalShowcase: string
  goalManageable: string
  outputs: OutputState[]
}

function toFormState(p?: AdminProject): FormState {
  const c = p?.caseContent
  const lines = (v?: string[]) => (v ?? []).join("\n")
  return {
    slug: p?.slug ?? "",
    icon: p?.icon ?? "",
    name: p?.name ?? "",
    desc: p?.desc ?? "",
    longDesc: p?.longDesc ?? "",
    tags: p?.tags.join(", ") ?? "",
    link: p?.link ?? "",
    demo: p?.demo ?? "",
    category: p?.category ?? "recommended",
    sortOrder: String(p?.sortOrder ?? 0),
    ownership: p?.ownership ?? "",
    maturity: p?.maturity ?? "",
    featured: p?.featured ?? false,
    coverUrl: p?.cover?.url ?? "",
    coverAlt: p?.cover?.alt ?? "",
    coverWidth: p?.cover?.width ? String(p.cover.width) : "",
    coverHeight: p?.cover?.height ? String(p.cover.height) : "",
    audience: c?.audience ?? "",
    scenario: c?.scenario ?? "",
    problem: c?.problem ?? "",
    role: c?.role ?? "",
    input: c?.input ?? "",
    dataFlow: c?.dataFlow ?? "",
    steps: lines(c?.steps),
    customization: lines(c?.customization),
    deliverables: lines(c?.deliverables),
    excluded: lines(c?.excluded),
    limits: lines(c?.limits),
    contribSelf: c?.contribution?.self ?? "",
    contribOpenSource: c?.contribution?.openSource ?? "",
    contribThirdParty: c?.contribution?.thirdParty ?? "",
    goalUsable: c?.goals?.usable ?? "",
    goalDeployable: c?.goals?.deployable ?? "",
    goalShowcase: c?.goals?.showcase ?? "",
    goalManageable: c?.goals?.manageable ?? "",
    outputs: (c?.outputs ?? []).map((o) => ({ ...o, poster: o.poster ?? "" })),
  }
}

// 表单 → API 请求体。空字符串一律变成 undefined，交给服务端统一丢掉
function toPayload(form: FormState, published: boolean) {
  const t = (v: string) => v.trim() || undefined
  const list = (v: string) => {
    const items = v.split("\n").map((s) => s.trim()).filter(Boolean)
    return items.length ? items : undefined
  }
  const num = (v: string) => (v.trim() ? Number(v) : undefined)

  const caseContent: CaseContent = {
    version: 1,
    audience: t(form.audience),
    scenario: t(form.scenario),
    problem: t(form.problem),
    role: t(form.role),
    input: t(form.input),
    dataFlow: t(form.dataFlow),
    steps: list(form.steps),
    customization: list(form.customization),
    deliverables: list(form.deliverables),
    excluded: list(form.excluded),
    limits: list(form.limits),
    contribution: {
      self: t(form.contribSelf),
      openSource: t(form.contribOpenSource),
      thirdParty: t(form.contribThirdParty),
    },
    goals: {
      usable: t(form.goalUsable),
      deployable: t(form.goalDeployable),
      showcase: t(form.goalShowcase),
      manageable: t(form.goalManageable),
    },
    outputs: form.outputs
      .filter((o) => o.url.trim())
      .map<CaseOutput>((o) => ({
        type: o.type,
        kind: o.kind,
        url: o.url.trim(),
        caption: o.caption.trim(),
        source: o.source.trim(),
        poster: t(o.poster),
      })),
  }
  // 两个嵌套对象全空时去掉，免得发布检查和预览把「空对象」当成「写了内容」
  if (!Object.values(caseContent.contribution!).some(Boolean)) delete caseContent.contribution
  if (!Object.values(caseContent.goals!).some(Boolean)) delete caseContent.goals
  if (!caseContent.outputs!.length) delete caseContent.outputs

  return {
    icon: form.icon.trim(),
    name: form.name.trim(),
    desc: form.desc.trim(),
    longDesc: form.longDesc.trim(),
    // 中英文逗号都认，空片段过滤掉
    tags: form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    link: form.link.trim(),
    demo: form.demo.trim(),
    category: form.category,
    sortOrder: Number(form.sortOrder),
    ownership: form.ownership || undefined,
    maturity: form.maturity || undefined,
    published,
    // 保存为未发布时自动取消精选（精选必须已发布）
    featured: published && form.featured,
    cover: form.coverUrl.trim()
      ? {
          url: form.coverUrl.trim(),
          alt: form.coverAlt.trim(),
          width: num(form.coverWidth),
          height: num(form.coverHeight),
        }
      : undefined,
    caseContent,
  }
}

const EMPTY_OUTPUT: OutputState = {
  type: "image",
  kind: "sample",
  url: "",
  caption: "",
  source: "",
  poster: "",
}

// 不传 initial = 新建，传 initial = 编辑现有项目
export function ProjectForm({ initial }: { initial?: AdminProject }) {
  const router = useRouter()
  const isEdit = initial !== undefined
  const wasPublished = initial?.published ?? false

  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateOutput(i: number, patch: Partial<OutputState>) {
    setForm((prev) => ({
      ...prev,
      outputs: prev.outputs.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    }))
  }

  // 实时发布检查：和服务端用的是同一个 checkPublish()，
  // 这里只是提前告诉运营还差什么，真正拦截的是服务端
  const publishMissing = useMemo(() => {
    const p = toPayload(form, true)
    return checkPublish({ ...p, cover: p.cover ?? null })
  }, [form])

  async function submit(published: boolean) {
    setError(null)
    setMissing([])
    setSaving(true)

    const payload = {
      // slug 是主键，编辑时不提交（也改不了），创建时才带上
      ...(isEdit ? {} : { slug: form.slug.trim() }),
      ...toPayload(form, published),
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

    // 失败时表单里的内容原样保留，改完可以直接再点保存
    const data = res ? await res.json().catch(() => null) : null
    setError(data?.error ?? "保存失败，请检查网络后重试（登录过期时也会这样，可以刷新页面重新登录）")
    setMissing(Array.isArray(data?.missing) ? data.missing : [])
    setSaving(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // 哪个按钮触发的提交：submitter 是浏览器原生属性
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const publish = submitter?.value === "publish"
    if (wasPublished && !publish) {
      const ok = window.confirm("这个项目现在是公开的。保存为未发布后，首页和详情页会立刻撤下它。确定吗？")
      if (!ok) return
    }
    submit(publish)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {/* ── 基础信息 ── */}
      <Group title="基础信息">
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
            />
          </Field>
        </div>

        <Field label="简介" hint="首页卡片上的一句话：为谁解决什么问题">
          <input
            className={inputClass}
            value={form.desc}
            onChange={(e) => update("desc", e.target.value)}
            required
          />
        </Field>

        <Field label="用途概述" hint="详情页「用途概述」的正文。写实际情况，不要照抄旧宣传语">
          <textarea
            className={`${inputClass} h-32 resize-y py-2`}
            value={form.longDesc}
            onChange={(e) => update("longDesc", e.target.value)}
            required
          />
        </Field>

        <Field label="标签" hint="逗号分隔；放在详情页底部，作为次级信息">
          <input
            className={inputClass}
            value={form.tags}
            onChange={(e) => update("tags", e.target.value)}
            required
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="项目链接（可选）" hint="与体验地址不同时，详情页不会额外显示">
            <input
              className={inputClass}
              type="url"
              value={form.link}
              onChange={(e) => update("link", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="体验地址（demo）" hint="「可体验」的项目必填；只有可体验的项目才会显示「立即体验」">
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
          <Field label="排序分组" hint="只影响首页的排列顺序，不再显示成「热门」「收藏」">
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
          <Field label="组内排序" hint="0-255，数字小的排前面">
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
      </Group>

      {/* ── 归属与成熟度 ── */}
      <Group title="归属与成熟度" desc="两项独立：自研的可以只能看成果，客户项目也可能可体验。没评估过就留空。">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="项目归属">
            <select
              className={inputClass}
              value={form.ownership}
              onChange={(e) => update("ownership", e.target.value as Ownership | "")}
            >
              <option value="">（未评估）</option>
              {OWNERSHIPS.map((o) => (
                <option key={o} value={o}>
                  {OWNERSHIP_LABELS[o]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="成熟度"
            hint="可体验 = 验收过、能完整跑通；成果演示 = 只看成果；开发中 = 本期不公开"
          >
            <select
              className={inputClass}
              value={form.maturity}
              onChange={(e) => update("maturity", e.target.value as Maturity | "")}
            >
              <option value="">（未评估）</option>
              {MATURITIES.map((m) => (
                <option key={m} value={m}>
                  {MATURITY_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => update("featured", e.target.checked)}
          />
          设为精选（首页「精选案例」区；要求已发布，并且有封面、输入样例和可调整项）
        </label>
      </Group>

      {/* ── 封面 ── */}
      <Group title="封面" desc="建议 16:10。地址用 / 开头的站内路径（放 public/ 下）或 https:// 地址。">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="封面地址">
            <input
              className={inputClass}
              value={form.coverUrl}
              onChange={(e) => update("coverUrl", e.target.value)}
              placeholder="/cases/clip-sketch/cover.jpg"
            />
          </Field>
          <Field label="替代文本（alt）" hint="图里是什么，读屏用户靠它理解">
            <input
              className={inputClass}
              value={form.coverAlt}
              onChange={(e) => update("coverAlt", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="宽（像素，可选）">
            <input
              className={inputClass}
              type="number"
              value={form.coverWidth}
              onChange={(e) => update("coverWidth", e.target.value)}
            />
          </Field>
          <Field label="高（像素，可选）" hint="填了宽高，图片加载时页面不会跳动">
            <input
              className={inputClass}
              type="number"
              value={form.coverHeight}
              onChange={(e) => update("coverHeight", e.target.value)}
            />
          </Field>
        </div>
      </Group>

      {/* ── 真实成果 ── */}
      <Group
        title="真实成果"
        desc="至少一项。每项都要写清是「示例成果」（预先生成的）还是「操作录像」，以及素材来源和授权。地址留空的行不会保存。"
      >
        {form.outputs.map((o, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-[120px_140px_1fr]">
              <select
                className={inputClass}
                aria-label="成果类型"
                value={o.type}
                onChange={(e) => updateOutput(i, { type: e.target.value as OutputType })}
              >
                {OUTPUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {{ image: "图片", video: "视频", file: "文件" }[t]}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                aria-label="成果标记"
                value={o.kind}
                onChange={(e) => updateOutput(i, { kind: e.target.value as OutputKind })}
              >
                {OUTPUT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {OUTPUT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                aria-label="成果地址"
                value={o.url}
                onChange={(e) => updateOutput(i, { url: e.target.value })}
                placeholder="地址：/cases/xxx.jpg 或 https://…"
              />
            </div>
            <input
              className={inputClass}
              aria-label="成果说明"
              value={o.caption}
              onChange={(e) => updateOutput(i, { caption: e.target.value })}
              placeholder="说明：用什么输入、得到了什么"
            />
            <input
              className={inputClass}
              aria-label="素材来源"
              value={o.source}
              onChange={(e) => updateOutput(i, { source: e.target.value })}
              placeholder="来源：如「团队自拍视频，可公开使用」"
            />
            {o.type === "video" && (
              <input
                className={inputClass}
                aria-label="视频封面"
                value={o.poster}
                onChange={(e) => updateOutput(i, { poster: e.target.value })}
                placeholder="视频封面地址（可选）"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setForm((prev) => ({ ...prev, outputs: prev.outputs.filter((_, j) => j !== i) }))
              }
            >
              删除这一项
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setForm((prev) => ({ ...prev, outputs: [...prev.outputs, { ...EMPTY_OUTPUT }] }))}
        >
          + 添加成果
        </Button>
      </Group>

      {/* ── 案例内容 ── */}
      <Group title="场景与过程">
        <Field label="适合谁">
          <input className={inputClass} value={form.audience} onChange={(e) => update("audience", e.target.value)} />
        </Field>
        <Field label="业务场景">
          <textarea className={textareaClass} value={form.scenario} onChange={(e) => update("scenario", e.target.value)} />
        </Field>
        <Field label="原来怎么做 / 卡在哪">
          <textarea className={textareaClass} value={form.problem} onChange={(e) => update("problem", e.target.value)} />
        </Field>
        <Field label="应用负责哪一步">
          <input className={inputClass} value={form.role} onChange={(e) => update("role", e.target.value)} />
        </Field>
        <Field label="输入样例说明" hint="公开样例是什么、从哪来">
          <textarea className={textareaClass} value={form.input} onChange={(e) => update("input", e.target.value)} />
        </Field>
        <Field label="关键步骤" hint="一行一步">
          <textarea className={textareaClass} value={form.steps} onChange={(e) => update("steps", e.target.value)} />
        </Field>
      </Group>

      <Group title="团队贡献" desc="开源基础要写明原作者；第三方模型如实列出。">
        <Field label="我们做的部分">
          <textarea className={textareaClass} value={form.contribSelf} onChange={(e) => update("contribSelf", e.target.value)} />
        </Field>
        <Field label="开源基础（可选）">
          <input className={inputClass} value={form.contribOpenSource} onChange={(e) => update("contribOpenSource", e.target.value)} />
        </Field>
        <Field label="第三方模型与服务（可选）">
          <input className={inputClass} value={form.contribThirdParty} onChange={(e) => update("contribThirdParty", e.target.value)} />
        </Field>
      </Group>

      <Group
        title="四个目标的项目说明"
        desc="写这个项目目前的真实情况。例如「可部署」要写清验证过的是团队托管还是客户环境；没有管理界面就如实说明维护方式。"
      >
        <Field label="可用">
          <textarea className={textareaClass} value={form.goalUsable} onChange={(e) => update("goalUsable", e.target.value)} />
        </Field>
        <Field label="可部署">
          <textarea className={textareaClass} value={form.goalDeployable} onChange={(e) => update("goalDeployable", e.target.value)} />
        </Field>
        <Field label="可展示">
          <textarea className={textareaClass} value={form.goalShowcase} onChange={(e) => update("goalShowcase", e.target.value)} />
        </Field>
        <Field label="可管理">
          <textarea className={textareaClass} value={form.goalManageable} onChange={(e) => update("goalManageable", e.target.value)} />
        </Field>
      </Group>

      <Group title="定制、交付与限制" desc="以下都是一行一项。">
        <Field label="可调整项">
          <textarea className={textareaClass} value={form.customization} onChange={(e) => update("customization", e.target.value)} />
        </Field>
        <Field label="交付物">
          <textarea className={textareaClass} value={form.deliverables} onChange={(e) => update("deliverables", e.target.value)} />
        </Field>
        <Field label="不包含">
          <textarea className={textareaClass} value={form.excluded} onChange={(e) => update("excluded", e.target.value)} />
        </Field>
        <Field label="限制与费用" hint="格式、容量、时长、是否要登录、额度、外部依赖">
          <textarea className={textareaClass} value={form.limits} onChange={(e) => update("limits", e.target.value)} />
        </Field>
        <Field label="数据去向" hint="存在哪、会发给谁（模型网关 / 供应商）、保留多久、怎么删">
          <textarea className={textareaClass} value={form.dataFlow} onChange={(e) => update("dataFlow", e.target.value)} />
        </Field>
      </Group>

      {/* ── 发布检查 ── */}
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">
          发布检查：
          {publishMissing.length === 0 ? (
            <span className="text-green-600 dark:text-green-400">全部通过，可以发布</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">还缺 {publishMissing.length} 项</span>
          )}
        </p>
        {publishMissing.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {publishMissing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {wasPublished
            ? "这个项目当前已公开。「保存并发布」会立即更新首页和详情页；内容不完整时只能先保存为未发布（会从前台撤下）。"
            : "这个项目当前未发布，前台看不到。内容没齐也可以先保存为未发布。"}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          <p>{error}</p>
          {missing.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" name="intent" value="publish" disabled={saving || publishMissing.length > 0}>
          {saving ? "保存中…" : "保存并发布"}
        </Button>
        <Button type="submit" name="intent" value="draft" variant="outline" disabled={saving}>
          {wasPublished ? "撤下并保存为未发布" : "保存为未发布"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  )
}

function Group({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-5">
      <legend className="mb-1 text-base font-semibold">{title}</legend>
      {desc && <p className="-mt-3 text-xs text-muted-foreground">{desc}</p>}
      {children}
    </fieldset>
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
