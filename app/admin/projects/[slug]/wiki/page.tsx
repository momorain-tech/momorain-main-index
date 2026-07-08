import Link from "next/link"
import { notFound } from "next/navigation"

import { getAdminProject, getProjectWiki } from "@/lib/projects-admin"
import { WikiEditor } from "@/components/admin/wiki-editor"

// 项目 Wiki 页：管理员的内部记录（部署方法、注意事项等）。
// 上层 admin layout 已做权限守卫，这里只管取数和展示
export default async function ProjectWikiPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // 先确认项目存在（顺便拿到名字做标题），再单独取 wiki——
  // wiki 不在 AdminProject 里，见 lib/projects-admin.ts 的说明
  const project = await getAdminProject(slug)
  if (!project) notFound()
  const wiki = (await getProjectWiki(slug)) ?? ""

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {project.icon} {project.name} — Wiki
        </h2>
        <p className="text-sm text-muted-foreground">
          仅管理员可见的内部记录，不会出现在访客页面。
          <Link href="/admin/projects" className="ml-2 underline underline-offset-4">
            返回列表
          </Link>
        </p>
      </div>
      <WikiEditor slug={slug} initialWiki={wiki} />
    </div>
  )
}
