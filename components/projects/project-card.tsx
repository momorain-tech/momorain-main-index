import Link from "next/link"

import type { Project } from "@/lib/projects"
import { projectConsultContext } from "@/lib/project-url"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import { ProjectLabels } from "@/components/projects/project-labels"

// 项目卡片（§5.1）。和旧版「神器货架」的区别：
// - 主入口是「查看项目」（进主站详情），不再直接把人送进工具
// - 「立即体验」只给成熟度为「可体验」的项目——那是验收过、确实能完整跑通的
// - 还没评估成熟度的老项目，保留一个不显眼的「打开工具页」，不打断已经在用工具的人，
//   但也不把它说成「验证过可以体验」
// - 技术栈不放卡片上，放详情页次级信息里
export function ProjectCard({ project, source }: { project: Project; source: string }) {
  const href = `/projects/${project.slug}`
  const canTry = project.maturity === "interactive" && project.demo
  const legacyTool = !project.maturity && project.demo

  return (
    <article className="proj-card">
      {project.cover ? (
        <Link href={href} className="proj-cover" tabIndex={-1} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- 封面可能是站外 https 地址，next/image 需要逐个配置域名白名单 */}
          <img
            src={project.cover.url}
            alt=""
            width={project.cover.width}
            height={project.cover.height}
            loading="lazy"
          />
        </Link>
      ) : null}
      <div className="proj-top">
        <span className="proj-icon" aria-hidden="true">
          {project.icon}
        </span>
        <div className="min-w-0">
          <h3 className="proj-name">
            <Link href={href}>{project.name}</Link>
          </h3>
          <ProjectLabels project={project} />
        </div>
      </div>
      <p className="proj-desc">{project.desc}</p>
      {project.caseContent?.audience && (
        <p className="proj-audience">适合：{project.caseContent.audience}</p>
      )}
      <div className="proj-meta">
        <Link className="proj-play" href={href}>
          查看项目
        </Link>
        {canTry && (
          <a className="proj-try" href={project.demo} target="_blank" rel="noreferrer">
            立即体验 ↗
          </a>
        )}
        {legacyTool && (
          <a className="proj-link" href={project.demo} target="_blank" rel="noreferrer">
            打开工具页 ↗
          </a>
        )}
        <ConsultationTrigger className="proj-link" context={projectConsultContext(project, source)}>
          咨询
        </ConsultationTrigger>
      </div>
    </article>
  )
}
