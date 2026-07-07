import { ProjectForm } from "@/components/admin/project-form"

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">新建项目</h2>
      <ProjectForm />
    </div>
  )
}
