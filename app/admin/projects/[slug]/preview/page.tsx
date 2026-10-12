import "@/app/jike.css"

import Link from "next/link"
import { notFound } from "next/navigation"

import { getAdminProject } from "@/lib/projects-admin"
import { checkPublish } from "@/lib/project-content"
import type { Project } from "@/lib/projects"
import { ConsultationProvider } from "@/components/consultation/consultation-provider"
import { ProjectDetail } from "@/components/projects/project-detail"

// 后台预览（§8.3）：未发布的项目也能看到它发布后的样子，缺的部分显示成「待补」。
//
// 为什么放在 /admin 下而不是给公开详情页加个 ?preview=1：
// - 这里受三层管理员守卫保护，草稿内容不会出现在任何公开 HTML 里
// - 公开详情页保持纯静态 ISR；要是在那里判断「当前是不是管理员」，
//   就得读 cookies()，整页会变成每请求动态渲染（CLAUDE.md 渲染模型一节的红线）
export default async function PreviewProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = await getAdminProject(slug)
  if (!admin) notFound()

  const missing = checkPublish(admin)
  // 只挑访客端会看到的字段传下去，和公开页面拿到的数据形状完全一样
  const project: Project = {
    slug: admin.slug,
    icon: admin.icon,
    name: admin.name,
    desc: admin.desc,
    longDesc: admin.longDesc,
    tags: admin.tags,
    link: admin.link,
    demo: admin.demo,
    ownership: admin.ownership,
    maturity: admin.maturity,
    featured: admin.featured,
    cover: admin.cover,
    caseContent: admin.caseContent,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <p>
          预览 · {admin.published ? "已发布" : "未发布（前台看不到）"}
          {missing.length > 0 ? ` · 发布检查还缺 ${missing.length} 项` : " · 发布检查通过"}
        </p>
        <div className="flex gap-4">
          <Link href={`/admin/projects/${slug}`} className="underline">
            去编辑
          </Link>
          {admin.published && (
            <a href={`/projects/${slug}`} target="_blank" rel="noreferrer" className="underline">
              看线上页面 ↗
            </a>
          )}
        </div>
      </div>
      {/* 套上公开页面的样式外壳；咨询按钮在这里也能点开，方便检查效果 */}
      <ConsultationProvider>
        <div className="jk jk-skin overflow-hidden rounded-xl border">
          <ProjectDetail project={project} preview />
        </div>
      </ConsultationProvider>
    </div>
  )
}
