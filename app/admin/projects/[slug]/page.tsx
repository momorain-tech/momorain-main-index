import { notFound } from "next/navigation"

import { getAdminProject } from "@/lib/projects-admin"
import { ProjectForm } from "@/components/admin/project-form"

// 编辑页：按 slug 读出现有数据填进表单
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = await getAdminProject(slug)
  if (!project) notFound()

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">编辑项目：{project.name}</h2>
      <ProjectForm initial={project} />
    </div>
  )
}
