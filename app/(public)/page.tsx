import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, ArrowRight, Check, Layers, Handshake } from "lucide-react"
import { getHomeProjects } from "@/lib/projects"
import { siteConfig } from "@/config/site"
import { goals, faqs, highExposureExcludeSlugs } from "@/config/home"
import { participationPaths } from "@/config/platform"
import { RevealRoot } from "@/components/jike/reveal"
import { ConsultationCard } from "@/components/consultation/consultation-card"
import { ProjectCard } from "@/components/projects/project-card"

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — 让技术找到需求，让需求走向落地` },
  description: siteConfig.description,
}
// 首页走 ISR：构建时生成静态 HTML，之后每 5 分钟按数据库最新数据在后台重新生成；
// 后台改项目时 lib/revalidate-project.ts 会立即刷新，不用等这 5 分钟
export const revalidate = 300

// 第二版首页只有四个区块，和导航一一对应（config/platform.ts 的 platformNavigation）：
//   #platform 平台介绍 → #services 服务内容（含折叠的 #faq）→ #projects Demo展示 → #contact 联系方式
// 改版前的旧锚点（#shelf、#about、#process…）由 components/jike/hash-scroll.tsx 映射到这四个。
// 文案和列表数据放在 config/ 下（home.ts、platform.ts），这里只管排版：改字不用读 JSX
export default async function HomePage() {
  const { featured, all } = await getHomeProjects()
  // 精选（大卡片，最多两个）必须有真实封面和成果，素材不齐宁可整块不显示，也不凑数；
  // highExposureExcludeSlugs 里的敏感项目不进精选（原因见 config/home.ts）
  const selected = featured
    .filter(
      (p) =>
        p.cover && p.caseContent?.outputs?.length && !highExposureExcludeSlugs.includes(p.slug),
    )
    .slice(0, 2)
  const selectedSlugs = new Set(selected.map((p) => p.slug))
  const others = all.filter((p) => !selectedSlugs.has(p.slug))
  return (
    <RevealRoot>
      {/* ① 平台介绍：左边是主张和两个身份入口，右边是「从 Demo 到合作」的三步示意 */}
      <header id="platform" className="platform-hero">
        <div className="wrap platform-hero-grid">
          <div>
            <span className="platform-eyebrow">
              <span /> 让 AI 能力与真实需求相遇
            </span>
            <h1>
              你有需求，
              <br />让 AI <span className="grad-text">来点真活。</span>
            </h1>
            <p className="platform-lead">让技术找到需求，让需求走向落地。</p>
            <p className="platform-description">
              通过真实 Demo 看见能力，通过需求梳理聊清方向。连接有 AI
              应用需求的企业与个人，以及能把想法做成产品的开发者和小团队。
            </p>
            <div className="hero-cta">
              <Link className="btn-primary" href="/requests/new">
                我有 AI 需求 <ArrowUpRight size={18} />
              </Link>
              <Link className="btn-ghost" href="/providers/join">
                我能提供 AI 服务 <ArrowUpRight size={18} />
              </Link>
            </div>
            <p className="platform-note">先看作品，再聊需求。当前由平台人工协助对接。</p>
          </div>
          <div className="platform-map" aria-label="平台协助双方从作品走向合作">
            <div className="platform-map-top">
              <span>从一个 Demo，到一次合作</span>
              <Layers size={20} />
            </div>
            <Link href="/#projects" className="platform-map-row">
              <span className="map-number">01</span>
              <div>
                <b>看见真实能力</b>
                <p>通过作品、过程与成果了解能做什么</p>
              </div>
              <ArrowRight size={18} />
            </Link>
            <Link href="/requests/new" className="platform-map-row">
              <span className="map-number">02</span>
              <div>
                <b>聊清具体需求</b>
                <p>明确问题、期望结果与合作边界</p>
              </div>
              <ArrowRight size={18} />
            </Link>
            <Link href="/#contact" className="platform-map-row">
              <span className="map-number">03</span>
              <div>
                <b>一起推进落地</b>
                <p>人工沟通方案，核对交付与验收</p>
              </div>
              <ArrowRight size={18} />
            </Link>
            <div className="platform-map-foot">
              <Handshake size={18} /> 作品有来源，合作有边界
            </div>
          </div>
        </div>
        <div className="wrap">
          <div className="platform-goals">
            {goals.map((g) => (
              <span key={g.key}>
                <Check size={15} /> {g.title}
              </span>
            ))}
            <small>我们希望每一次合作，都能落到实际交付。</small>
          </div>
        </div>
      </header>
      {/* ② 服务内容：需求方、服务方两张入口卡片；合作说明和 FAQ 收进折叠面板，
          不占首页篇幅，有需要的人再展开。旧链接 /#faq 会自动展开这个面板 */}
      <section id="services">
        <div className="wrap">
          <SectionHead
            kicker="For both sides"
            title="从适合你的入口开始"
            desc="有一个想解决的问题，或有一份值得被看见的作品，都可以从这里开始。"
          />
          <div className="participation-grid">
            {participationPaths.map((path, i) => (
              <article className="participation-card reveal" key={path.role}>
                <span className="path-index">
                  0{i + 1} / {path.role}
                </span>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <ol>
                  {path.steps.map((s, n) => (
                    <li key={s}>
                      <span>{n + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <Link
                  className={i === 0 ? "btn-primary btn-md" : "btn-ghost btn-md"}
                  href={path.href}
                >
                  {path.action}
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
          <details id="faq" className="platform-details">
            <summary>平台如何协助？查看合作说明与常见问题</summary>
            <div className="platform-details-body">
              <p>
                当前先做好资料梳理、作品展示和人工沟通。方案、报价、服务方人选及合作确认由双方沟通后核对；提交作品不代表审核通过，也不保证获得订单。
              </p>
              <p>
                项目是否可用、如何部署、怎样展示以及由谁维护，需要在合作范围里逐项明确。部分作品基于开源项目改造，详情页保留来源和原作者。
              </p>
              <div className="faq-list">
                {faqs.map((f) => (
                  <details className="faq-item" key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </details>
        </div>
      </section>
      {/* ③ Demo展示：精选大卡片 + 其余作品的普通卡片 */}
      <section id="projects" className="demo-section">
        <div className="wrap">
          <SectionHead
            kicker="Work speaks"
            title="Demo展示"
            desc="看看 AI 能解决哪些实际问题。通过真实作品了解效果、使用条件，以及背后的服务能力。"
          />
          {selected.length > 0 && (
            <div className="demo-featured-grid">
              {selected.map((p) => (
                <ProjectCard key={p.slug} project={p} source="featured" />
              ))}
            </div>
          )}
          {selected.length > 0 && others.length > 0 && (
            <h3 className="other-demos-title">更多作品</h3>
          )}
          {others.length > 0 && (
            <div className="proj-grid">
              {others.map((p) => (
                <ProjectCard key={p.slug} project={p} source="list" />
              ))}
            </div>
          )}
          {all.length === 0 && (
            <p className="empty-note">作品资料正在整理，你也可以先联系我们交流需求或作品。</p>
          )}
          <p className="demo-footnote">
            自研作品、团队自用与客户项目按实际归属标注。实时体验的条件以详情页说明为准。
          </p>
        </div>
      </section>
      {/* ④ 联系方式：左边按身份分流到资料整理页（约 60%），右边直接摆出微信（compact 卡片，
          服务端渲染，JS 没加载也能看到微信号） */}
      <section id="contact">
        <div className="wrap">
          <SectionHead
            kicker="Let’s talk"
            title="有需求，或有能力，都可以联系 AI有活。"
            desc="企业与团队可以沟通 AI 项目需求，个人与小团队可以交流作品展示及服务合作。"
          />
          <div className="platform-contact-grid">
            <div className="contact-paths">
              {participationPaths.map((path) => (
                <Link className="contact-path" href={path.href} key={path.role}>
                  <div>
                    <h3>{path.title}</h3>
                    <p>
                      {path.role === "需求方"
                        ? "沟通业务问题，了解方案与合作方式"
                        : "整理作品与服务资料，交流合作机会"}
                    </p>
                    <span>
                      {path.action} <ArrowRight size={16} />
                    </span>
                  </div>
                  <ArrowUpRight size={22} />
                </Link>
              ))}
            </div>
            <ConsultationCard context={{ source: "contact", intent: "general" }} compact />
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
