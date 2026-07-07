import Link from "next/link"

import { getAdminProjects, type AdminProject } from "@/lib/projects-admin"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { DeleteProjectButton } from "@/components/admin/delete-project-button"

const CATEGORY_LABELS: Record<AdminProject["category"], string> = {
  recommended: "猜你喜欢",
  trending: "当前最热",
  starred: "用户收藏",
}

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {projects.length} 个项目</p>
        <Link
          href="/admin/projects/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          新建项目
        </Link>
      </div>

      {/* 表格宽度可能超出小屏幕，让它在自己的容器里横向滚动 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">项目</th>
              <th className="px-4 py-3 font-medium">slug</th>
              <th className="px-4 py-3 font-medium">分区</th>
              <th className="px-4 py-3 font-medium">排序</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.slug} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{project.icon}</span>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {project.desc}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {project.slug}
                </td>
                <td className="px-4 py-3">{CATEGORY_LABELS[project.category]}</td>
                <td className="px-4 py-3">{project.sortOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
