import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { getHomeProjects } from "@/lib/projects"
import { siteConfig } from "@/config/site"
import { faqs, highExposureExcludeSlugs } from "@/config/home"
import { participationPaths } from "@/config/platform"
import { contactConfig } from "@/config/contact"
import { RevealRoot } from "@/components/jike/reveal"
import { ConsultationCard } from "@/components/consultation/consultation-card"
import { EmailCard } from "@/components/consultation/email-card"
import { ProjectCard } from "@/components/projects/project-card"

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — 让 AI 能力，落到真实业务` },
  description: siteConfig.description,
}
// 首页走 ISR：构建时生成静态 HTML，之后每 5 分钟按数据库最新数据在后台重新生成；
// 后台改项目时 lib/revalidate-project.ts 会立即刷新，不用等这 5 分钟
export const revalidate = 300

// 首页四个区块，和导航一一对应（config/platform.ts 的 platformNavigation）：
//   #platform 平台介绍 → #services 服务内容（含折叠的 #faq）→ #projects Demo展示 → #contact 联系方式
// 改版前的旧锚点（#shelf、#about、#process…）由 components/jike/hash-scroll.tsx 映射到这四个。
//
// 第三版（docs/MAIN_INDEX_V3_DEVELOPMENT.md §3）做的是减法：
// - 两类身份入口只在「服务内容」出现一次；首屏、联系区不再重复
// - 删掉首屏右侧的三步流程卡、「可用/可部署/可展示/可管理」口号横条、英文小标题
// - 区块标题直接用导航上的名字，访客点导航和看到的标题对得上
export default async function HomePage() {
  const { featured, all } = await getHomeProjects()
  // 精选（大卡片，最多两个）必须有**真实截图**封面和成果，素材不齐宁可整块不显示，也不凑数；
  // 功能示意图封面（kind: "illustration"）不能拿来当精选；敏感项目不进精选（原因见 config/home.ts）
  const selected = featured
    .filter(
      (p) =>
        p.cover &&
        p.cover.kind !== "illustration" &&
        p.caseContent?.outputs?.length &&
        !highExposureExcludeSlugs.includes(p.slug),
    )
    .slice(0, 2)
  const selectedSlugs = new Set(selected.map((p) => p.slug))
  // 没有封面的作品排到最后：夹在有封面的卡片中间时，同一行会被撑出一大块空白。
  // sort 是稳定的，有封面的、没封面的各自保持原来的顺序
  const hasCover = (p: (typeof all)[number]) =>
    !!p.cover || !!p.caseContent?.outputs?.some((o) => o.type === "image")
  const others = all
    .filter((p) => !selectedSlugs.has(p.slug))
    .sort((a, b) => Number(hasCover(b)) - Number(hasCover(a)))
  return (
    <RevealRoot>
      {/* ① 平台介绍：一段话说清平台是做什么的，下面三个轻量锚点跳到其余区块 */}
      <header id="platform" className="platform-hero">
        <div className="wrap">
          <h1>让 AI 能力，落到真实业务。</h1>
          <p className="platform-description">
            {siteConfig.name}连接有业务升级需求的企业与提供 AI 服务的个人和团队，通过需求分析、作品展示与人工对接，推进项目落地。
          </p>
          {/* 用 div + role 而不是 <nav>：jike.css 里 `.jk nav` 是顶部吸顶导航栏的样式 */}
          <div className="platform-anchors" role="navigation" aria-label="页面区块">
            <Link href="/#services">
              服务内容 <ArrowRight size={16} />
            </Link>
            <Link href="/#projects">
              Demo展示 <ArrowRight size={16} />
            </Link>
            <Link href="/#contact">
              联系方式 <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>
      {/* ② 服务内容：两张入口卡，每张只有标题、一段说明、一个按钮。
          合作说明和 FAQ 收进折叠面板，旧链接 /#faq 会自动展开它 */}
      <section id="services">
        <div className="wrap">
          <SectionHead title="服务内容" />
          <div className="participation-grid">
            {participationPaths.map((path, i) => (
              <article className="participation-card reveal" key={path.role}>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <Link className={i === 0 ? "btn-primary btn-md" : "btn-ghost btn-md"} href={path.href}>
                  {path.action}
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
          <details id="faq" className="platform-details">
            <summary>合作说明与常见问题</summary>
            <div className="platform-details-body">
              <p>
                提交的需求和服务资料会保存在平台后台，由专人跟进；需求还可以选择让 AI
                做一次初步分析，辅助判断方向。方案、报价、人选和合作范围由双方沟通后确认，提交不代表订单或审核通过。
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
          <SectionHead title="Demo展示" desc="通过真实作品了解 AI 能解决的实际问题、使用条件和背后的服务能力。" />
          {selected.length > 0 && (
            <div className="demo-featured-grid">
              {selected.map((p) => (
                <ProjectCard key={p.slug} project={p} source="featured" />
              ))}
            </div>
          )}
          {selected.length > 0 && others.length > 0 && <h3 className="other-demos-title">更多作品</h3>}
          {others.length > 0 && (
            <div className="proj-grid">
              {others.map((p) => (
                <ProjectCard key={p.slug} project={p} source="list" />
              ))}
            </div>
          )}
          {all.length === 0 && <p className="empty-note">作品资料正在整理，可以先通过下方联系方式交流。</p>}
          <p className="demo-footnote">
            标有「功能示意」的封面是说明图，不是运行截图。作品归属按实际情况标注，体验条件以详情页说明为准。
          </p>
        </div>
      </section>
      {/* ④ 联系方式：只放微信和邮箱。微信卡是服务端渲染的 compact 卡片，JS 没加载也能看到微信号；
          邮箱没配置（config/contact.ts 的 email 为空）时整张卡不出现，不放一个假地址 */}
      <section id="contact">
        <div className="wrap">
          <SectionHead title="联系方式" />
          <div className={`platform-contact-grid${contactConfig.email ? "" : " single"}`}>
            <ConsultationCard context={{ source: "contact", intent: "general" }} compact />
            {contactConfig.email && <EmailCard email={contactConfig.email} />}
          </div>
        </div>
      </section>
    </RevealRoot>
  )
}
function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="sec-head reveal">
      <h2>{title}</h2>
      {desc && <p>{desc}</p>}
    </div>
  )
}
