import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

import { getProjectBySlug, getAllSlugs } from "@/lib/projects"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DemoToggle } from "@/components/demo-toggle"

// ─── 类型定义 ─────────────────────────────────────────────────────

type Props = {
  params: Promise<{ slug: string }>
}

// ─── 静态生成 + ISR ───────────────────────────────────────────────
// 构建时查询数据库，把所有存在的 slug 预渲染成静态 HTML；
// 之后最多每 5 分钟在后台按 DB 最新数据重新生成。
// 构建后新增的 slug 首次访问时按需渲染（dynamicParams 默认开启）

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

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)

  if (!project) notFound()

  return (
        <div className="container py-10 md:py-16">
          {/* 返回按钮 */}
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-8 -ml-2 text-muted-foreground"
            )}
          >
            ← 返回首页
          </Link>

          {/* 项目标题区 */}
          <div className="mb-10 flex items-start gap-6">
            <span className="text-6xl leading-none">{project.icon}</span>
            <div>
              <h1 className="text-4xl font-bold">{project.name}</h1>
              <p className="mt-2 text-lg text-muted-foreground">{project.desc}</p>
              {/* 标签列表 */}
              <div className="mt-4 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border bg-muted px-3 py-1 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 详细介绍 */}
          <div className="max-w-2xl rounded-xl border bg-background p-8">
            <h2 className="mb-4 text-xl font-semibold">项目介绍</h2>
            <p className="leading-relaxed text-muted-foreground">{project.longDesc}</p>
          </div>

          {/* Demo 开关：内嵌展示或新标签打开 */}
          {project.demo && <DemoToggle url={project.demo} />}

          {/* 外部项目主页链接（仅 demo 与 link 不同时展示） */}
          {project.link && project.link !== project.demo && (
            <div className="mt-4">
              <a
                href={project.link}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                访问项目主页 →
              </a>
            </div>
          )}
        </div>
  )
}
