import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getProjectBySlug, getAllSlugs } from "@/lib/projects"
import { ProjectDetail } from "@/components/projects/project-detail"

// ─── 类型定义 ─────────────────────────────────────────────────────

type Props = {
  params: Promise<{ slug: string }>
}

// ─── 静态生成 + ISR ───────────────────────────────────────────────
// 构建时查询数据库，把所有**已发布**的 slug 预渲染成静态 HTML；
// 之后最多每 5 分钟在后台按 DB 最新数据重新生成。
// 构建后新增的 slug 首次访问时按需渲染（dynamicParams 默认开启）。
// 未发布 / 已撤下的项目，getProjectBySlug 返回 undefined → 404，
// 和 getAllSlugs 用的是同一个过滤条件（见 lib/projects.ts 的 PUBLIC_FILTER）

export const revalidate = 300

export async function generateStaticParams() {
  const slugs = await getAllSlugs()
  return slugs.map((slug) => ({ slug }))
}

// ─── 动态 SEO 元数据 ──────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  if (!project) return {}
  return {
    title: project.name,
    description: project.desc,
  }
}

// ─── 页面组件 ─────────────────────────────────────────────────────
// 内容全在 ProjectDetail 里（后台预览也用它），这里只负责取数和 404

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) notFound()

  return <ProjectDetail project={project} />
}
