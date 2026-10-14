import { query, isDbConfigured } from "@/lib/db"
import { STATIC_PROJECTS } from "@/lib/projects-data"
import type {
  CaseContent,
  Maturity,
  Ownership,
  ProjectCover,
} from "@/lib/project-content"

// 访客端看到的项目。注意这里**没有** wiki、category、published——
// 能出现在这个类型里的字段，都是可以原样印到公开 HTML 里的
export type Project = {
  slug: string
  icon: string
  name: string
  desc: string
  longDesc: string
  tags: string[]
  link?: string
  demo?: string
  ownership?: Ownership // undefined = 还没评估（迁移 004 之前的老项目）
  maturity?: Maturity
  featured: boolean
  cover?: ProjectCover
  caseContent?: CaseContent
}

// MySQL 行的字段名（snake_case），与 Project 类型字段做映射
type ProjectRow = {
  slug: string
  icon: string
  name: string
  desc_short: string
  long_desc: string
  tags: string[] // JSON 列，mysql2 的 typeCast 会自动 parse
  link: string | null
  demo: string | null
  ownership: Ownership | null
  maturity: Maturity | null
  featured: number // TINYINT(1)，mysql2 读出来是 0 / 1，不是布尔
  cover: ProjectCover | null
  case_content: CaseContent | null
}

// 显式列清单（不写 SELECT *）：wiki 这种内部字段就算以后表里再加，也不会被顺手带出来
const PROJECT_COLUMNS =
  "slug, icon, name, desc_short, long_desc, tags, link, demo, " +
  "ownership, maturity, featured, cover, case_content"

// 公开查询的唯一过滤条件。首页、详情、预渲染清单三处共用这一个常量——
// 如果有一处忘了加，下架的项目就会从那一处漏出来（§9.3 第 6 条）
const PUBLIC_FILTER = "published = 1"

// 过渡补丁（2026-10-15，用户拍板「不改生产库」）：线上 projects 表还没跑 migrations/007，
// cover.url 仍指向旧的 cover.svg。这里统一改写成 Seedream jpg——部署即生效，不写数据库。
// 007 跑完（或后台把封面换成真实截图）后，这个改写不再命中任何行，成为空操作，可整体删除。
function rewriteLegacyCover(slug: string, cover: ProjectCover | null): ProjectCover | null {
  if (!cover || !cover.url.includes(`/images/demos/${slug}/cover.svg`)) return cover
  return {
    url: `/images/demos/${slug}/cover.jpg`,
    alt: cover.alt,
    width: 2560,
    height: 1600,
    kind: cover.kind ?? "illustration",
  }
}

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
    ownership: row.ownership ?? undefined,
    maturity: row.maturity ?? undefined,
    featured: row.featured === 1,
    cover: rewriteLegacyCover(row.slug, row.cover) ?? undefined,
    caseContent: row.case_content ?? undefined,
  }
}

// 当 DB 环境变量未配置时（本地开发），直接返回静态数据
// 注意：fallback 只处理"未配置"，不处理"配置了但连不上"——
// 后者应该让错误抛出来（fail fast），而不是静默退回陈旧数据
let warnedFallback = false
function useDb(): boolean {
  const configured = isDbConfigured()
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

// 首页：全部已发布项目（排序沿用后台的分区 + 分区内排序），以及从中挑出的精选。
// category 不再表示「热门 / 用户收藏」——那是用户行为数据，我们没有；
// 它现在只是后台排序用的分组
export async function getHomeProjects(): Promise<{
  featured: Project[]
  all: Project[]
}> {
  const all = useDb()
    ? (
        await query<ProjectRow>(
          `SELECT ${PROJECT_COLUMNS} FROM projects
           WHERE ${PUBLIC_FILTER}
           ORDER BY category, sort_order`
        )
      ).map(rowToProject)
    : STATIC_PROJECTS
  return { featured: all.filter((p) => p.featured), all }
}

// 所有公开 slug，用于 generateStaticParams 预渲染
export async function getAllSlugs(): Promise<string[]> {
  if (!useDb()) return STATIC_PROJECTS.map((p) => p.slug)

  const rows = await query<{ slug: string }>(
    `SELECT slug FROM projects WHERE ${PUBLIC_FILTER}`
  )
  return rows.map((r) => r.slug)
}

// 单个项目详情。未发布的项目和不存在的项目一样返回 undefined → 详情页 404
export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  if (!useDb()) return STATIC_PROJECTS.find((p) => p.slug === slug)

  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE slug = ? AND ${PUBLIC_FILTER} LIMIT 1`,
    [slug]
  )
  return rows[0] ? rowToProject(rows[0]) : undefined
}
