import type { Metadata } from "next"
import Link from "next/link"
import { momorainProvider as provider } from "@/config/platform"
import { highExposureExcludeSlugs } from "@/config/home"
import { getHomeProjects } from "@/lib/projects"
import { ProjectCard } from "@/components/projects/project-card"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = { title: "momorain 团队 · 服务与作品" }
export const revalidate = 300
export default async function ProviderPage() {
  const { all } = await getHomeProjects()
  // 只列已确认归属团队的作品；敏感项目不进这个新的高曝光页（规则和首页精选共用一份）
  const projects = all.filter(
    (p) => provider.projectSlugs.includes(p.slug) && !highExposureExcludeSlugs.includes(p.slug),
  )
  return (
    <div className="wrap provider-page">
      <Link className="detail-back" href="/#projects">
        ← 返回 Demo展示
      </Link>
      <header className="provider-profile">
        <span className="provider-monogram" aria-hidden="true">
          m
        </span>
        <div>
          <span className="kicker">{provider.type} · 平台团队</span>
          <h1>{provider.name}</h1>
          <p>{provider.intro}</p>
          <div className="demo-tags">
            {provider.directions.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <p className="field-hint">{provider.availability}</p>
          <ConsultationTrigger
            className="btn-primary btn-md"
            context={{
              source: "provider-profile",
              intent: "demand",
              provider: {
                name: provider.name,
                url: `${siteConfig.url}/providers/${provider.slug}`,
              },
            }}
          >
            咨询此服务方
          </ConsultationTrigger>
        </div>
      </header>
      <section>
        <h2>代表作品</h2>
        <p className="detail-muted">查看实际用途、成果与团队贡献，使用条件以各作品详情为准。</p>
        <div className="proj-grid">
          {projects.map((p) => (
            <ProjectCard project={p} source="provider" key={p.slug} />
          ))}
        </div>
      </section>
      <section className="provider-scope">
        <h2>服务范围与合作说明</h2>
        <p>
          围绕内容生产、业务辅助、网站与应用等任务，沟通原型、应用开发、模型集成、部署与操作文档。具体可承接范围以项目评估为准。
        </p>
        <p>
          报价方式、排期、源码交付、部署环境、维护支持与第三方费用逐项沟通，不预设统一价格或周期。
        </p>
        <p>
          部分项目基于开源项目改造，详情中说明原作与团队承担的工作。页面署名不是“认证专家”或交付担保。
        </p>
        <Link className="inline-link" href="/requests/new">
          整理我的需求 →
        </Link>
      </section>
    </div>
  )
}
