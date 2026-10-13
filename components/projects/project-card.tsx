import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Project } from "@/lib/projects"
import { projectProvider, projectScenarios } from "@/config/platform"
import { ProjectLabels } from "@/components/projects/project-labels"

// 一个清晰的主动作：先看成果，再到详情决定体验或联系。缺素材不伪造封面。
export function ProjectCard({ project, source }: { project: Project; source: string }) {
  const href = `/projects/${project.slug}`
  const provider = projectProvider(project.slug)
  const cover = project.cover ?? (() => {
    const image = project.caseContent?.outputs?.find((o) => o.type === "image")
    return image ? { url: image.url, alt: image.caption } : undefined
  })()
  const tags = projectScenarios(project.slug)
  return <article className={`proj-card demo-card${source === "featured" ? " demo-card-featured" : ""}`}>
    {cover && <Link href={href} className="demo-cover" tabIndex={-1} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- 成果资源来自已校验的媒体地址 */}
      <img src={cover.url} alt="" loading="lazy" />
      {project.maturity === "interactive" && project.demo ? <span className="demo-cover-status">可在线体验</span> : project.caseContent?.outputs?.length ? <span className="demo-cover-status">观看成果</span> : null}
    </Link>}
    <div className="demo-card-body"><ProjectLabels project={project} />
      <h3 className="proj-name"><Link href={href}>{project.name}</Link></h3><p className="proj-desc">{project.desc}</p>
      {tags.length > 0 && <div className="demo-tags">{tags.slice(0, 2).map((t) => <span key={t}>{t}</span>)}</div>}
      <div className="demo-card-bottom"><span className="demo-author">{provider ? <Link href={`/providers/${provider.slug}`}>{provider.name}</Link> : "提供者资料整理中"}</span>
        <Link className="demo-result-link" href={href}>{project.caseContent?.outputs?.length ? "查看成果" : "了解作品"}<ArrowUpRight size={16} /></Link>
      </div>
    </div>
  </article>
}
