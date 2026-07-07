import { query, isDbConfigured } from "@/lib/db"

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

// 管理端看到的完整项目（比访客端的 Project 多 category / sortOrder）
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
}

// 创建 / 更新时提交的数据（slug 是主键，创建后不允许改）
export type ProjectInput = Omit<AdminProject, "slug">

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
}

const ADMIN_COLUMNS =
  "slug, icon, name, desc_short, long_desc, tags, link, demo, category, sort_order"

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

export type ValidationResult =
  | { ok: true; value: ProjectInput }
  | { ok: false; error: string }

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

  return {
    ok: true,
    value: {
      icon: (d.icon as string).trim(),
      name: (d.name as string).trim(),
      desc: (d.desc as string).trim(),
      longDesc: (d.longDesc as string).trim(),
      tags: (d.tags as string[]).map((t) => t.trim()),
      link: d.link ? (d.link as string) : undefined,
      demo: d.demo ? (d.demo as string) : undefined,
      category: d.category as ProjectCategory,
      sortOrder,
    },
  }
}

// ─── 读 ──────────────────────────────────────────────────────────

// 返回 null 表示 DB 未配置（本地开发），页面据此显示提示而不是崩溃
export async function getAdminProjects(): Promise<AdminProject[] | null> {
  if (!isDbConfigured()) return null
  const rows = await query<AdminRow>(
    `SELECT ${ADMIN_COLUMNS} FROM projects ORDER BY category, sort_order`
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

export async function createProject(slug: string, input: ProjectInput): Promise<void> {
  assertDb()
  await query(
    `INSERT INTO projects
       (slug, icon, name, desc_short, long_desc, tags, link, demo, category, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      input.icon,
      input.name,
      input.desc,
      input.longDesc,
      JSON.stringify(input.tags),
      input.link ?? null,
      input.demo ?? null,
      input.category,
      input.sortOrder,
    ]
  )
}

// 返回是否真的更新到了记录（slug 不存在时为 false）
export async function updateProject(slug: string, input: ProjectInput): Promise<boolean> {
  assertDb()
  const result = await query<never>(
    `UPDATE projects SET
       icon = ?, name = ?, desc_short = ?, long_desc = ?,
       tags = ?, link = ?, demo = ?, category = ?, sort_order = ?
     WHERE slug = ?`,
    [
      input.icon,
      input.name,
      input.desc,
      input.longDesc,
      JSON.stringify(input.tags),
      input.link ?? null,
      input.demo ?? null,
      input.category,
      input.sortOrder,
      slug,
    ]
  )
  // UPDATE/DELETE 时 mysql2 返回的不是行数组而是 ResultSetHeader
  return (result as unknown as { affectedRows: number }).affectedRows > 0
}

export async function deleteProject(slug: string): Promise<boolean> {
  assertDb()
  const result = await query<never>("DELETE FROM projects WHERE slug = ?", [slug])
  return (result as unknown as { affectedRows: number }).affectedRows > 0
}
