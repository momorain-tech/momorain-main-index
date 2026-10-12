import type { Metadata } from "next"
import Link from "next/link"

import { getHomeProjects, type Project } from "@/lib/projects"
import { siteConfig } from "@/config/site"
import {
  aboutCopy,
  faqs,
  goals,
  heroCopy,
  heroExcludeSlugs,
  processSteps,
  services,
} from "@/config/home"
import { RevealRoot } from "@/components/jike/reveal"
import { ConsultationCard } from "@/components/consultation/consultation-card"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import { ProjectCard } from "@/components/projects/project-card"

// 首页（docs/MAIN_INDEX_EVOLUTION_V1.md §4）。
// 区块顺序：业务说明 → 真实成果 → 能解决的问题 → 项目列表 → 交付流程 → 团队 → FAQ → 联系。
//
// 和改版前相比删掉了什么、为什么（§2.2）：
// - 「大家在聊」的群聊消息和「3,412 人」：虚构的，没有可公开的证据
// - 两张「即将上架」的占位卡、「8 个神器已上架」：数量里混了不存在的工具
// - 「最热门」「大家最爱」徽章：其实只是后台分区，不是用户行为统计
// - 「即将开放」的定制 / 上架按钮：点了只弹提示。定制改成真的微信咨询，上架入口本期不做
// - 「30 秒上手」「0 下载」：没验证过的承诺
//
// 固定文案在 config/home.ts，项目数据来自 lib/projects（只含已发布项目）

export const metadata: Metadata = {
  // absolute：不带根布局的 "%s | 即刻体验 · momorain" 模板，避免标题重复品牌名
  title: { absolute: `${siteConfig.name} · ${siteConfig.brand} — 让你的想法，成为真正用得起来的应用` },
  description: siteConfig.description,
}

// ISR：构建时预渲染，最多每 5 分钟后台刷新；后台改了项目会立即 revalidatePath("/")
export const revalidate = 300

export default async function HomePage() {
  const { featured, all } = await getHomeProjects()
  const bySlug = new Map(all.map((p) => [p.slug, p]))

  return (
    <RevealRoot>
      {/* ── 首屏：左文案、右代表成果（§4.2） ── */}
      <header className="hero hero-split" id="top">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="hero-badge">{heroCopy.kicker}</span>
            <h1>{heroCopy.title}</h1>
            <p className="sub">{heroCopy.sub}</p>
            <div className="hero-cta">
              <ConsultationTrigger className="btn-primary" context={{ source: "hero" }}>
                咨询定制
              </ConsultationTrigger>
              <Link className="btn-ghost" href="/#projects">
                查看真实项目
              </Link>
            </div>
            <p className="hero-note">{heroCopy.note}</p>
          </div>
          <HeroShowcase featured={featured} all={all} />
        </div>
      </header>

      {/* ── 四个目标 ── */}
      <section id="goals" className="sec-tight" aria-label="四个交付标准">
        <div className="wrap">
          <div className="goals-grid">
            {goals.map((g, i) => (
              <div key={g.key} className="goal-card reveal" style={{ transitionDelay: `${0.05 * i}s` }}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </div>
            ))}
          </div>
          <p className="goals-foot reveal">这是我们的交付标准。每个案例做到了哪些，项目详情里逐项说明。</p>
        </div>
      </section>

      {/* ── 精选案例：没有合格的精选项目时整块不显示，不拿占位凑数 ── */}
      {featured.length > 0 && (
        <section id="featured">
          <div className="wrap">
            <SectionHead kicker="Featured" title="精选案例" desc="真实的输入和输出，以及这个项目交付了什么。" />
            <div className="proj-grid proj-grid-featured">
              {featured.map((p) => (
                <div key={p.slug} className="reveal">
                  <ProjectCard project={p} source="featured" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 服务内容 ── */}
      <section id="services">
        <div className="wrap">
          <SectionHead
            kicker="Services"
            title="我们能帮你做什么"
            desc="按要解决的业务任务划分。具体能做到什么程度，在需求评估后确认。"
          />
          <div className="service-grid">
            {services.map((s, i) => {
              const related = s.relatedSlugs
                .map((slug) => bySlug.get(slug))
                .filter((p): p is Project => !!p)
              return (
                <div key={s.title} className="service-card reveal" style={{ transitionDelay: `${0.06 * i}s` }}>
                  <h3>{s.title}</h3>
                  <dl>
                    <dt>适合谁</dt>
                    <dd>{s.audience}</dd>
                    <dt>解决什么</dt>
                    <dd>{s.solves}</dd>
                    <dt>可交付什么</dt>
                    <dd>{s.deliverables}</dd>
                  </dl>
                  {related.length > 0 && (
                    <p className="service-related">
                      相关案例：
                      {related.map((p, j) => (
                        <span key={p.slug}>
                          {j > 0 && "、"}
                          <Link href={`/projects/${p.slug}`}>{p.name}</Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 全部项目 ── */}
      <section id="projects">
        <div className="wrap">
          <SectionHead
            kicker="Projects"
            title="项目案例"
            desc="都是已经上线运行的真实项目。点进去可以看用途、使用条件和交付范围。"
          />
          {all.length > 0 ? (
            <div className="proj-grid">
              {all.map((p, i) => (
                <div key={p.slug} className="reveal" style={{ transitionDelay: `${0.06 * (i % 3)}s` }}>
                  <ProjectCard project={p} source="list" />
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-note">项目资料正在整理，可以先通过下方微信联系我们。</p>
          )}
        </div>
      </section>

      {/* ── 合作流程 ── */}
      <section id="process">
        <div className="wrap">
          <SectionHead kicker="Process" title="合作流程" desc="每一步都写清楚：你提供什么、我们交付什么、在哪里确认。" />
          <ol className="process-list">
            {processSteps.map((s, i) => (
              <li key={s.title} className="process-step reveal" style={{ transitionDelay: `${0.05 * i}s` }}>
                <div className="n" aria-hidden="true">
                  {i + 1}
                </div>
                <h3>{s.title}</h3>
                <dl>
                  <dt>你提供</dt>
                  <dd>{s.client}</dd>
                  <dt>我们交付</dt>
                  <dd>{s.team}</dd>
                  <dt>确认点</dt>
                  <dd>{s.confirm}</dd>
                </dl>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 关于我们 ── */}
      <section id="about">
        <div className="wrap">
          <div className="about-box reveal">
            <span className="kicker">About</span>
            <h2>{aboutCopy.title}</h2>
            {aboutCopy.paragraphs.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <a href={siteConfig.links.github} target="_blank" rel="noreferrer" className="about-link">
              GitHub · momorain-tech ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ：用原生 <details>，展开收起不需要任何 JS，键盘也天然可用 ── */}
      <section id="faq">
        <div className="wrap">
          <SectionHead kicker="FAQ" title="常见问题" />
          <div className="faq-list">
            {faqs.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 联系合作：咨询对话框打不开（比如 JS 没加载）时，这里也能找到微信号（§4.1） ── */}
      <section id="contact">
        <div className="wrap">
          <div className="contact-box">
            <div>
              <span className="kicker">Contact</span>
              <h2>
                把你的想法告诉我们，<span className="grad-text">一起把它做成能用的应用</span>
              </h2>
              <p>
                先聊需求，再谈范围和报价。浏览、看案例和微信咨询都不需要登录。
              </p>
            </div>
            <ConsultationCard context={{ source: "contact" }} />
          </div>
        </div>
      </section>
    </RevealRoot>
  )
}

function SectionHead({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="sec-head reveal">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {desc && <p>{desc}</p>}
    </div>
  )
}

// 首屏右侧的「代表成果」。优先级：
// 1. 精选项目的第一张真实成果图 / 封面（带「示例成果 · 项目名」说明）
// 2. 都没有：列出已上线的真实项目（名字 + 一句话 + 链接）
// 第 2 种不是成果展示，但它是真的；文档要求宁可这样，也不能放装饰性的假界面（§4.2）
function HeroShowcase({ featured, all }: { featured: Project[]; all: Project[] }) {
  for (const p of featured) {
    const img = p.caseContent?.outputs?.find((o) => o.type === "image")
    const src = img?.url ?? p.cover?.url
    if (!src) continue
    return (
      <figure className="hero-visual">
        <Link href={`/projects/${p.slug}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 成果图可能是站外 https 地址 */}
          <img src={src} alt={img?.caption ?? p.cover?.alt ?? p.name} />
        </Link>
        <figcaption>
          <span className="output-kind">示例成果</span>
          {p.name}
          {img?.caption ? ` · ${img.caption}` : ""}
        </figcaption>
      </figure>
    )
  }

  const list = all.filter((p) => !heroExcludeSlugs.includes(p.slug)).slice(0, 5)
  if (list.length === 0) return null
  return (
    <div className="hero-visual hero-list">
      <p className="hero-list-title">正在运行的项目</p>
      <ul>
        {list.map((p) => (
          <li key={p.slug}>
            <Link href={`/projects/${p.slug}`}>
              <span className="proj-icon" aria-hidden="true">
                {p.icon}
              </span>
              <span className="min-w-0">
                <b>{p.name}</b>
                <span className="hero-list-desc">{p.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
