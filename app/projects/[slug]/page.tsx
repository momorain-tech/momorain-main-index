import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

import { getProjectBySlug, ALL_PROJECTS } from "@/lib/projects"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MainNav } from "@/components/main-nav"
import { SiteFooter } from "@/components/site-footer"
import { DemoToggle } from "@/components/demo-toggle"

// ─── 类型定义 ─────────────────────────────────────────────────────
// Next.js 把动态路由参数通过 params 传进来
// [slug] 文件夹名 → params.slug 字段名，两者一一对应

type Props = {
  params: Promise<{ slug: string }>
}

// ─── 静态生成（可选但推荐）────────────────────────────────────────
// generateStaticParams 告诉 Next.js：构建时把这些路径全部预渲染成静态 HTML
// 好处：访问速度极快，不需要服务器实时计算
// 如果不写这个函数，页面也能工作，只是改为"按需渲染"

export async function generateStaticParams() {
  return ALL_PROJECTS.map((project) => ({
    slug: project.slug,
  }))
}

// ─── 动态 SEO 元数据 ──────────────────────────────────────────────
// generateMetadata 根据当前页面的 slug 生成对应的 <title> 和 <meta>
// 这样每个项目页都有独立的 SEO 信息，对搜索引擎友好

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = getProjectBySlug(slug)
  if (!project) return {}
  return {
    title: project.name,
    description: project.desc,
  }
}

// ─── 页面组件 ─────────────────────────────────────────────────────

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = getProjectBySlug(slug)

  // notFound() 是 Next.js 内置函数，访问不存在的 slug 时自动返回 404 页面
  if (!project) notFound()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container z-40 bg-background">
        <div className="flex h-20 items-center justify-between py-6">
          <MainNav />
        </div>
      </header>

      <main className="flex-1">
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
      </main>

      <SiteFooter />
    </div>
  )
}
