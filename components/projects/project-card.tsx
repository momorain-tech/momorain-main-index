import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Project } from "@/lib/projects"
import { resultOutputs } from "@/lib/project-content"
import { projectScenarios } from "@/config/platform"
import { ProjectLabels } from "@/components/projects/project-labels"

// 作品卡片（第二版起；第四版只用在首页「更多作品」）。和第一版的区别：
// - 只留一个主动作「查看成果 / 了解作品」进详情页：卡片上不再并排放「立即体验 / 打开工具页 / 咨询」，
//   让访客先看到成果和使用条件，再在详情页决定体验还是联系（第二版需求文档的要求）
// - 封面优先用后台填的 cover，没有就借第一张图片成果；都没有就不显示封面。
//   第三版起允许「功能示意图」当过渡封面（cover.kind = "illustration"），但必须带「功能示意」角标
// - source="featured" 是首页精选的大卡片样式，其余位置是普通卡片
export function ProjectCard({ project, source }: { project: Project; source: string }) {
  const href = `/projects/${project.slug}`
  const results = resultOutputs(project.caseContent)
  const cover =
    project.cover ??
    (() => {
      const image = results.find((o) => o.type === "image")
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
          {/* 功能示意图封面：右上角固定标「功能示意」。图里本来也印着「非运行截图」，
              但卡片裁切后不一定看得到，这里再说一遍（第三版 §9.1） */}
          {"kind" in cover && cover.kind === "illustration" && (
            <span className="demo-cover-kind">功能示意</span>
          )}
          {project.maturity === "interactive" && project.demo ? (
            <span className="demo-cover-status">可在线体验</span>
          ) : results.length ? (
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
          {/* 第四版起不再按作品署服务方名字：对外统一是一个核心团队（首页 #team）。
              开源改造的作品，原作者署名在详情页的「团队贡献」里 */}
          <span className="demo-author">核心团队</span>
          <Link className="demo-result-link" href={href}>
            {results.length ? "查看成果" : "了解作品"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
