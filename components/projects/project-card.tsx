import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Project } from "@/lib/projects"
import { projectProvider, projectScenarios } from "@/config/platform"
import { ProjectLabels } from "@/components/projects/project-labels"

// 作品卡片（第二版）。和第一版的区别：
// - 只留一个主动作「查看成果 / 了解作品」进详情页：卡片上不再并排放「立即体验 / 打开工具页 / 咨询」，
//   让访客先看到成果和使用条件，再在详情页决定体验还是联系（第二版需求文档的要求）
// - 封面优先用后台填的 cover，没有就借第一张图片成果；都没有就不显示封面，不用图标或示意图凑数
// - source="featured" 是首页精选的大卡片样式，其余位置是普通卡片
export function ProjectCard({ project, source }: { project: Project; source: string }) {
  const href = `/projects/${project.slug}`
  const provider = projectProvider(project.slug)
  const cover =
    project.cover ??
    (() => {
      const image = project.caseContent?.outputs?.find((o) => o.type === "image")
      return image ? { url: image.url, alt: image.caption } : undefined
    })()
  const tags = projectScenarios(project.slug)
  return (
    <article className={`proj-card demo-card${source === "featured" ? " demo-card-featured" : ""}`}>
      {cover && (
        <Link href={href} className="demo-cover" tabIndex={-1} aria-hidden="true">
          {/* 不写 width/height 也不会让页面跳动：外层 .demo-cover 用 CSS 固定了 16:10 的比例，
              图片还没加载时位置就已经占好了；object-fit: cover 负责把不同比例的图裁进去 */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 封面可能是站外 https 地址，next/image 需要逐个配置域名白名单 */}
          <img src={cover.url} alt="" loading="lazy" />
          {project.maturity === "interactive" && project.demo ? (
            <span className="demo-cover-status">可在线体验</span>
          ) : project.caseContent?.outputs?.length ? (
            <span className="demo-cover-status">观看成果</span>
          ) : null}
        </Link>
      )}
      <div className="demo-card-body">
        <ProjectLabels project={project} />
        <h3 className="proj-name">
          <Link href={href}>{project.name}</Link>
        </h3>
        <p className="proj-desc">{project.desc}</p>
        {tags.length > 0 && (
          <div className="demo-tags">
            {tags.slice(0, 2).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        <div className="demo-card-bottom">
          <span className="demo-author">
            {provider ? (
              <Link href={`/providers/${provider.slug}`}>{provider.name}</Link>
            ) : (
              "提供者资料整理中"
            )}
          </span>
          <Link className="demo-result-link" href={href}>
            {project.caseContent?.outputs?.length ? "查看成果" : "了解作品"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
