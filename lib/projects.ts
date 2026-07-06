import { query } from "@/lib/db"
import {
  STATIC_RECOMMENDED,
  STATIC_TRENDING,
  STATIC_STARRED,
} from "@/lib/projects-data"

export type Project = {
  slug: string
  icon: string
  name: string
  desc: string
  longDesc: string
  tags: string[]
  link?: string
  demo?: string
}

// MySQL 行的字段名（snake_case），与 Project 类型字段做映射
type ProjectRow = {
  slug: string
  icon: string
  name: string
  desc_short: string
  long_desc: string
  tags: string[]      // JSON 列，mysql2 的 typeCast 会自动 parse
  link: string | null
  demo: string | null
  category: "recommended" | "trending" | "starred"
}

// 显式列清单，与 ProjectRow 一一对应；schema 加列时这里不受影响
const PROJECT_COLUMNS =
  "slug, icon, name, desc_short, long_desc, tags, link, demo, category"

function rowToProject(row: ProjectRow): Project {
  return {
    slug: row.slug,
    icon: row.icon,
    name: row.name,
    desc: row.desc_short,
    longDesc: row.long_desc,
    tags: row.tags,
    link: row.link ?? undefined,
    demo: row.demo ?? undefined,
  }
}

// 当 DB 环境变量未配置时（本地开发），直接返回静态数据
// 注意：fallback 只处理"未配置"，不处理"配置了但连不上"——
// 后者应该让错误抛出来（fail fast），而不是静默退回陈旧数据
let warnedFallback = false
function isDbConfigured(): boolean {
  const configured = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME)
  if (!configured && !warnedFallback) {
    warnedFallback = true
    console.warn(
      "[projects] DB 环境变量未配置（DB_HOST/DB_USER/DB_PASSWORD/DB_NAME），" +
        "正在使用 lib/projects-data.ts 的静态 fallback 数据。生产环境看到此日志说明配置有误。"
    )
  }
  return configured
}

// ─── 公开 API ─────────────────────────────────────────────────────

// 首页三个分区的项目列表
export async function getHomeProjects(): Promise<{
  recommended: Project[]
  trending: Project[]
  starred: Project[]
}> {
  if (!isDbConfigured()) {
    return {
      recommended: STATIC_RECOMMENDED,
      trending: STATIC_TRENDING,
      starred: STATIC_STARRED,
    }
  }

  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY category, sort_order`
  )
  return {
    recommended: rows.filter((r) => r.category === "recommended").map(rowToProject),
    trending:    rows.filter((r) => r.category === "trending").map(rowToProject),
    starred:     rows.filter((r) => r.category === "starred").map(rowToProject),
  }
}

// 所有 slug，用于 generateStaticParams 预渲染
export async function getAllSlugs(): Promise<string[]> {
  if (!isDbConfigured()) {
    return [
      ...STATIC_RECOMMENDED,
      ...STATIC_TRENDING,
      ...STATIC_STARRED,
    ].map((p) => p.slug)
  }

  const rows = await query<{ slug: string }>("SELECT slug FROM projects")
  return rows.map((r) => r.slug)
}

// 单个项目详情，用于详情页
export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  if (!isDbConfigured()) {
    return [...STATIC_RECOMMENDED, ...STATIC_TRENDING, ...STATIC_STARRED].find(
      (p) => p.slug === slug
    )
  }

  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE slug = ? LIMIT 1`,
    [slug]
  )
  return rows[0] ? rowToProject(rows[0]) : undefined
}
