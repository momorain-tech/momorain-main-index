import { MATURITY_LABELS, OWNERSHIP_LABELS } from "@/lib/project-content"
import type { Project } from "@/lib/projects"

// 归属和成熟度两个标签，分开显示（§5.1：自研项目可以稳定可用，客户项目也可能只能看成果）。
// 还没评估的老项目（迁移 004 之前的）两个都不显示——不替它们下结论。
//
// 这里刻意没有「热门」「大家最爱」这类徽章：那是用户行为统计，我们没有这份数据
export function ProjectLabels({ project }: { project: Pick<Project, "ownership" | "maturity"> }) {
  if (!project.ownership && !project.maturity) return null
  return (
    <div className="proj-labels">
      {project.maturity && (
        <span className={`proj-label maturity-${project.maturity}`}>
          {MATURITY_LABELS[project.maturity]}
        </span>
      )}
      {project.ownership && <span className="proj-label">{OWNERSHIP_LABELS[project.ownership]}</span>}
    </div>
  )
}
