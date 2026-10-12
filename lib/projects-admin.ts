import { query, isDbConfigured } from "@/lib/db"
import {
  MATURITIES,
  OWNERSHIPS,
  checkPublish,
  validateCaseContent,
  validateCover,
  type CaseContent,
  type Maturity,
  type Ownership,
  type ProjectCover,
} from "@/lib/project-content"

// ─── 管理后台专用数据层 ───────────────────────────────────────────
//
// 与 lib/projects.ts 的分工：
// - lib/projects.ts   面向访客页面，只读，DB 未配置时退回静态数据
// - lib/projects-admin.ts 面向管理后台，含写操作，必须有数据库——
//   写操作没有"静态 fallback"可言（改了没地方存），所以 DB 未配置时直接报错
//
// 依赖方向保持单向：admin 页面 / API → 本模块 → lib/db.ts

export const PROJECT_CATEGORIES = ["recommended", "trending", "starred"] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

// 管理端看到的完整项目（比访客端的 Project 多 category / sortOrder / published / updatedAt）
export type AdminProject = {
  slug: string
  icon: string
  name: string
  desc: string
  longDesc: string
  tags: string[]
  link?: string
  demo?: string
  category: ProjectCategory
  sortOrder: number
  ownership?: Ownership
  maturity?: Maturity
  published: boolean
  featured: boolean
  cover?: ProjectCover
  caseContent?: CaseContent
  updatedAt?: string // ISO 字符串（只读，由 MySQL 的 ON UPDATE 自动维护）
}

// 创建 / 更新时提交的数据（slug 是主键，创建后不允许改；updatedAt 由数据库维护）
export type ProjectInput = Omit<AdminProject, "slug" | "updatedAt">

type AdminRow = {
  slug: string
  icon: string
  name: string
  desc_short: string
  long_desc: string
  tags: string[]
  link: string | null
  demo: string | null
  category: ProjectCategory
  sort_order: number
  ownership: Ownership | null
  maturity: Maturity | null
  published: number // TINYINT(1) 读出来是 0 / 1
  featured: number
  cover: ProjectCover | null
  case_content: CaseContent | null
  updated_at: Date | null
}

const ADMIN_COLUMNS =
  "slug, icon, name, desc_short, long_desc, tags, link, demo, category, sort_order, " +
  "ownership, maturity, published, featured, cover, case_content, updated_at"

function rowToAdminProject(row: AdminRow): AdminProject {
  return {
    slug: row.slug,
    icon: row.icon,
    name: row.name,
    desc: row.desc_short,
    longDesc: row.long_desc,
    tags: row.tags,
    link: row.link ?? undefined,
    demo: row.demo ?? undefined,
    category: row.category,
    sortOrder: row.sort_order,
    ownership: row.ownership ?? undefined,
    maturity: row.maturity ?? undefined,
    published: row.published === 1,
    featured: row.featured === 1,
    cover: row.cover ?? undefined,
    caseContent: row.case_content ?? undefined,
    // Date 对象传不过 Server → Client 组件的边界，统一转成字符串
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }
}

function assertDb(): void {
  if (!isDbConfigured()) {
    throw new Error(
      "管理后台需要数据库：请在 .env.local 配置 DB_HOST/DB_NAME/DB_USER/DB_PASSWORD"
    )
  }
}

// ─── 输入校验 ─────────────────────────────────────────────────────
// API 收到的 body 是不可信的 unknown，逐字段校验后才能进 SQL。
// 项目没有引入 zod 这类校验库，数据结构简单，手写足够

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function validateSlug(value: unknown): string | null {
  if (typeof value !== "string" || !SLUG_PATTERN.test(value) || value.length > 100) {
    return null
  }
  return value
}

// missing：发布检查没通过时的缺项列表（API 据此回 422，后台逐条显示）
export type ValidationResult =
  | { ok: true; value: ProjectInput }
  | { ok: false; error: string; missing?: string[] }

export function validateProjectInput(data: unknown): ValidationResult {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "请求体必须是 JSON 对象" }
  }
  const d = data as Record<string, unknown>

  // 必填字符串字段：字段名 → [中文名, 最大长度]
  // 注意单位：VARCHAR(n) 的 n 是"字符"数，直接比 .length 即可
  const required: [keyof ProjectInput & string, string, number][] = [
    ["icon", "图标", 20],
    ["name", "名称", 100],
    ["desc", "简介", 500],
  ]
  for (const [field, label, maxLen] of required) {
    const v = d[field]
    if (typeof v !== "string" || v.trim() === "") {
      return { ok: false, error: `${label}（${field}）不能为空` }
    }
    if (v.length > maxLen) {
      return { ok: false, error: `${label}（${field}）超过 ${maxLen} 字符上限` }
    }
  }

  // longDesc 对应的 TEXT 列上限是 65535 **字节**（不是字符）——
  // 中文每字占 3 字节，按字符数校验会放过超长文本、让 MySQL 报错变成 500
  const longDesc = d.longDesc
  if (typeof longDesc !== "string" || longDesc.trim() === "") {
    return { ok: false, error: "详细介绍（longDesc）不能为空" }
  }
  if (Buffer.byteLength(longDesc, "utf8") > 65535) {
    return { ok: false, error: "详细介绍（longDesc）超过 65535 字节上限（约 2 万汉字）" }
  }

  if (
    !Array.isArray(d.tags) ||
    d.tags.some((t) => typeof t !== "string" || t.trim() === "" || t.length > 50)
  ) {
    return { ok: false, error: "标签（tags）必须是非空字符串数组" }
  }

  // 可选链接字段：允许缺省，填了就必须是 http(s) URL
  for (const field of ["link", "demo"] as const) {
    const v = d[field]
    if (v === undefined || v === null || v === "") continue
    if (typeof v !== "string" || !/^https?:\/\//.test(v) || v.length > 500) {
      return { ok: false, error: `链接（${field}）必须是 http(s):// 开头的网址` }
    }
  }

  if (!PROJECT_CATEGORIES.includes(d.category as ProjectCategory)) {
    return { ok: false, error: "分区（category）必须是 recommended/trending/starred 之一" }
  }

  const sortOrder = d.sortOrder
  if (
    typeof sortOrder !== "number" ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 255 // 对应表结构 TINYINT UNSIGNED 的取值范围
  ) {
    return { ok: false, error: "排序（sortOrder）必须是 0-255 的整数" }
  }

  // ── 迁移 004 加的字段 ──
  // 归属 / 成熟度：允许留空（= 还没评估），填了就必须是已知取值
  for (const [field, allowed, label] of [
    ["ownership", OWNERSHIPS, "归属"],
    ["maturity", MATURITIES, "成熟度"],
  ] as const) {
    const v = d[field]
    if (v === undefined || v === null || v === "") continue
    if (!(allowed as readonly string[]).includes(v as string)) {
      return { ok: false, error: `${label}（${field}）必须是 ${allowed.join(" / ")} 之一` }
    }
  }
  if (typeof d.published !== "boolean" || typeof d.featured !== "boolean") {
    return { ok: false, error: "published / featured 必须是 true 或 false" }
  }

  const cover = validateCover(d.cover)
  if (!cover.ok) return cover
  const caseContent = validateCaseContent(d.caseContent)
  if (!caseContent.ok) return caseContent

  const value: ProjectInput = {
    icon: (d.icon as string).trim(),
    name: (d.name as string).trim(),
    desc: (d.desc as string).trim(),
    longDesc: (d.longDesc as string).trim(),
    tags: (d.tags as string[]).map((t) => t.trim()),
    link: d.link ? (d.link as string) : undefined,
    demo: d.demo ? (d.demo as string) : undefined,
    category: d.category as ProjectCategory,
    sortOrder,
    ownership: (d.ownership || undefined) as Ownership | undefined,
    maturity: (d.maturity || undefined) as Maturity | undefined,
    published: d.published,
    featured: d.featured,
    cover: cover.value,
    caseContent: caseContent.value,
  }

  // 精选必须已发布：精选区只从已发布项目里挑，一个「精选但未发布」的项目没有意义
  if (value.featured && !value.published) {
    return { ok: false, error: "精选项目必须同时发布。要撤下请先取消精选" }
  }

  // 发布门槛（§8.2）：要公开就必须过完整检查——
  // 这里是服务端的真正防线，后台表单上的实时缺项提示只是为了少走一趟
  if (value.published) {
    const missing = checkPublish(value)
    if (missing.length) {
      return {
        ok: false,
        error: "还不能发布：内容不完整。可以先「保存为未发布」，补齐后再发布",
        missing,
      }
    }
  }

  return { ok: true, value }
}

// ─── 读 ──────────────────────────────────────────────────────────

// 返回 null 表示 DB 未配置（本地开发），页面据此显示提示而不是崩溃
export async function getAdminProjects(): Promise<AdminProject[] | null> {
  if (!isDbConfigured()) return null
  // 已发布的排前面，同一状态内按前台的展示顺序
  const rows = await query<AdminRow>(
    `SELECT ${ADMIN_COLUMNS} FROM projects ORDER BY published DESC, category, sort_order`
  )
  return rows.map(rowToAdminProject)
}

export async function getAdminProject(slug: string): Promise<AdminProject | null> {
  if (!isDbConfigured()) return null
  const rows = await query<AdminRow>(
    `SELECT ${ADMIN_COLUMNS} FROM projects WHERE slug = ? LIMIT 1`,
    [slug]
  )
  return rows[0] ? rowToAdminProject(rows[0]) : null
}

// ─── 写 ──────────────────────────────────────────────────────────
// SQL 一律用 ? 占位符传值（参数化查询），杜绝 SQL 注入——
// 即使值已经过校验，也不要用字符串拼接写 SQL

// INSERT 和 UPDATE 共用的参数顺序（必须和两条 SQL 里的列顺序一致）。
// JSON 列要先 stringify；mysql2 遇到 undefined 会报错，空值一律转成 null
function inputToValues(input: ProjectInput) {
  return [
    input.icon,
    input.name,
    input.desc,
    input.longDesc,
    JSON.stringify(input.tags),
    input.link ?? null,
    input.demo ?? null,
    input.category,
    input.sortOrder,
    input.ownership ?? null,
    input.maturity ?? null,
    input.published ? 1 : 0,
    input.featured ? 1 : 0,
    input.cover ? JSON.stringify(input.cover) : null,
    input.caseContent ? JSON.stringify(input.caseContent) : null,
  ]
}

export async function createProject(slug: string, input: ProjectInput): Promise<void> {
  assertDb()
  await query(
    `INSERT INTO projects
       (slug, icon, name, desc_short, long_desc, tags, link, demo, category, sort_order,
        ownership, maturity, published, featured, cover, case_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [slug, ...inputToValues(input)]
  )
}

// 返回是否真的更新到了记录（slug 不存在时为 false）
export async function updateProject(slug: string, input: ProjectInput): Promise<boolean> {
  assertDb()
  const result = await query<never>(
    `UPDATE projects SET
       icon = ?, name = ?, desc_short = ?, long_desc = ?,
       tags = ?, link = ?, demo = ?, category = ?, sort_order = ?,
       ownership = ?, maturity = ?, published = ?, featured = ?, cover = ?, case_content = ?
     WHERE slug = ?`,
    [...inputToValues(input), slug]
  )
  // UPDATE/DELETE 时 mysql2 返回的不是行数组而是 ResultSetHeader
  return (result as unknown as { affectedRows: number }).affectedRows > 0
}

// ─── 状态切换（发布 / 撤下 / 撤下试用） ─────────────────────────────
// 为什么单独一个函数、而不是让前端带着整个项目再 PUT 一遍：
// 列表页上点一下「撤下」，手里只有 slug，没有完整内容；
// 让前端拼一份完整 body 去 PUT，漏一个字段就会把库里的内容冲掉（和 wiki 单独接口同一个道理）
//
// 「撤下试用」和「撤下案例」是两回事（§8.2）：
// - stop-trial：工具临时不能用了，但成果是真的 → 成熟度改成「成果演示」，项目照样公开
// - unpublish：内容不准确 / 授权有问题 → 整个项目从前台消失（精选一并取消）
export const STATUS_ACTIONS = ["publish", "unpublish", "stop-trial"] as const
export type StatusAction = (typeof STATUS_ACTIONS)[number]

export type StatusResult =
  | { ok: true; project: AdminProject }
  | { ok: false; status: 404 | 422; error: string; missing?: string[] }

export async function updateProjectStatus(
  slug: string,
  action: StatusAction
): Promise<StatusResult> {
  assertDb()
  const current = await getAdminProject(slug)
  if (!current) return { ok: false, status: 404, error: `项目 "${slug}" 不存在` }

  const next: AdminProject = { ...current }
  if (action === "publish") next.published = true
  if (action === "unpublish") {
    next.published = false
    next.featured = false
  }
  if (action === "stop-trial") next.maturity = "showcase"

  // 切换后仍然公开的，要重新过一遍发布检查（比如改成「成果演示」后依然得有真实成果）
  if (next.published) {
    const missing = checkPublish(next)
    if (missing.length) {
      return { ok: false, status: 422, error: "内容不完整，不能处于公开状态", missing }
    }
  }

  await query(
    "UPDATE projects SET published = ?, featured = ?, maturity = ? WHERE slug = ?",
    [next.published ? 1 : 0, next.featured ? 1 : 0, next.maturity ?? null, slug]
  )
  return { ok: true, project: next }
}

export async function deleteProject(slug: string): Promise<boolean> {
  assertDb()
  const result = await query<never>("DELETE FROM projects WHERE slug = ?", [slug])
  return (result as unknown as { affectedRows: number }).affectedRows > 0
}

// ─── Wiki ─────────────────────────────────────────────────────────
// wiki 是管理员的内部记录（部署方法、注意事项等），只在 /admin 可见：
// - 不放进 AdminProject——列表页不需要拖着一大段文本一起查
// - 永远不进访客端 lib/projects.ts——内部信息不该出现在公开页面
// 所以它有自己独立的读写函数和校验，而不是挤进 ProjectInput

export type WikiValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string }

export function validateWiki(value: unknown): WikiValidationResult {
  if (typeof value !== "string") {
    return { ok: false, error: "wiki 内容必须是字符串" }
  }
  // 与 longDesc 同理：TEXT 列上限是 65535 字节（不是字符）
  if (Buffer.byteLength(value, "utf8") > 65535) {
    return { ok: false, error: "wiki 超过 65535 字节上限（约 2 万汉字），考虑精简或拆分" }
  }
  return { ok: true, value }
}

// 返回 null 表示项目不存在（或 DB 未配置）；
// 项目存在但从未写过 wiki（列为 NULL）时返回 ""，调用方不用再分辨两种"没有"
export async function getProjectWiki(slug: string): Promise<string | null> {
  if (!isDbConfigured()) return null
  const rows = await query<{ wiki: string | null }>(
    "SELECT wiki FROM projects WHERE slug = ? LIMIT 1",
    [slug]
  )
  if (!rows[0]) return null
  return rows[0].wiki ?? ""
}

// 返回是否真的更新到了记录（slug 不存在时为 false）
export async function updateProjectWiki(slug: string, wiki: string): Promise<boolean> {
  assertDb()
  // 清空时存回 NULL 而不是空字符串，和"从未写过"保持同一种表示
  const result = await query<never>("UPDATE projects SET wiki = ? WHERE slug = ?", [
    wiki.trim() === "" ? null : wiki,
    slug,
  ])
  return (result as unknown as { affectedRows: number }).affectedRows > 0
}
