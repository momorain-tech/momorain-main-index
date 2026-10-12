import Link from "next/link"

import { getAdminProjects } from "@/lib/projects-admin"
import { MATURITY_LABELS, OWNERSHIP_LABELS, checkPublish } from "@/lib/project-content"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { DeleteProjectButton } from "@/components/admin/delete-project-button"
import { ProjectStatusButton } from "@/components/admin/project-status-button"

// 项目管理列表。上层 layout 已做权限守卫 + 使页面成为每请求 SSR，
// 所以这里每次访问都是数据库里的最新数据
export default async function AdminProjectsPage() {
  const projects = await getAdminProjects()

  // null = 本地开发未配置数据库。写操作没有静态 fallback 可用，
  // 与其让页面崩溃，不如明确告诉自己怎么回事
  if (projects === null) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        本地未配置数据库（DB_HOST 等环境变量为空），管理后台不可用。
        <br />
        如需本地调试，可用 SSH 隧道连到服务器的 MySQL 后填写 .env.local。
      </div>
    )
  }

  const publishedCount = projects.filter((p) => p.published).length
  const featuredCount = projects.filter((p) => p.featured).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          共 {projects.length} 个项目 · 已发布 {publishedCount} · 精选 {featuredCount}
          {featuredCount < 2 && "（上线要求至少 2 个精选）"}
        </p>
        <Link href="/admin/projects/new" className={cn(buttonVariants({ size: "sm" }))}>
          新建项目
        </Link>
      </div>

      {/* 表格宽度可能超出小屏幕，让它在自己的容器里横向滚动 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">项目</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">归属 / 成熟度</th>
              <th className="px-4 py-3 font-medium">发布检查</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const missing = checkPublish(project)
              return (
                <tr key={project.slug} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{project.icon}</span>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{project.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {project.published ? "已发布" : <span className="text-muted-foreground">未发布</span>}
                    {project.featured && " · 精选"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {project.ownership ? OWNERSHIP_LABELS[project.ownership] : "未评估"} /{" "}
                    {project.maturity ? MATURITY_LABELS[project.maturity] : "未评估"}
                  </td>
                  <td className="px-4 py-3">
                    {missing.length === 0 ? (
                      <span className="text-green-600 dark:text-green-400">通过</span>
                    ) : (
                      // title：鼠标悬停看具体缺哪些；编辑页上有完整清单
                      <span
                        className="text-amber-600 dark:text-amber-400"
                        title={missing.join("\n")}
                      >
                        缺 {missing.length} 项
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/projects/${project.slug}/preview`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        预览
                      </Link>
                      <Link
                        href={`/admin/projects/${project.slug}/wiki`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Wiki
                      </Link>
                      {project.published && project.maturity === "interactive" && (
                        <ProjectStatusButton slug={project.slug} action="stop-trial" />
                      )}
                      {project.published ? (
                        <ProjectStatusButton slug={project.slug} action="unpublish" />
                      ) : (
                        missing.length === 0 && <ProjectStatusButton slug={project.slug} action="publish" />
                      )}
                      <Link
                        href={`/admin/projects/${project.slug}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        编辑
                      </Link>
                      <DeleteProjectButton slug={project.slug} name={project.name} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
