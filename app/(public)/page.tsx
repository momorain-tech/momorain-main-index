import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import { getHomeProjects, type Project } from "@/lib/projects"
import { siteConfig } from "@/config/site"
import { faqs } from "@/config/home"
import { contactConfig } from "@/config/contact"
import {
  cooperationForms,
  cooperationSteps,
  heroSceneId,
  scenes,
  teamRoles,
  type Scene,
} from "@/config/showcase"
import { RevealRoot } from "@/components/jike/reveal"
import { ConsultationCard } from "@/components/consultation/consultation-card"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import { EmailCard } from "@/components/consultation/email-card"
import { ProjectCard } from "@/components/projects/project-card"
import { HeroEvidence, SceneBlock, hasEvidence, primaryProject } from "@/components/showcase/scene-parts"

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — 把视频和资料，变成可查看的 AI 成果` },
  description: siteConfig.description,
}
// 首页走 ISR：构建时生成静态 HTML，之后每 5 分钟按数据库最新数据在后台重新生成；
// 后台改项目时 lib/revalidate-project.ts 会立即刷新，不用等这 5 分钟。
// 登录状态、咨询表单都是客户端组件自己去取，不会让这一页变成每次访问都查库
export const revalidate = 300

// 第四版首页（2026-10-19，依据第四版改版建议）：以实际成果为主的团队合作入口。
// 访客的路线：看懂一个业务任务 → 查看真实输入与输出 → 了解适用条件 → 找核心团队评估。
//
//   #top 首屏（用途 + 一个固定场景的输入输出）
//   #scenes 场景导航（只负责跳转，不再做三张宣传大卡）→ #scene-<id> 重点演示
//   #more 更多作品 → #cooperation 合作方式（含折叠的 #faq）→ #team 核心团队 → #contact 页尾咨询
//
// 改版前的旧锚点（#platform、#services、#projects、#shelf…）由 components/jike/hash-scroll.tsx 映射过来。
// 场景内容在 config/showcase.ts（详情页共用），真实成果在后台的案例内容里（不改代码就能补）
export default async function HomePage() {
  const { all } = await getHomeProjects()
  const bySlug = new Map(all.map((p) => [p.slug, p]))

  // 只展示主作品已发布的场景；场景里其余已发布的作品作为「同场景作品」列出
  const shown = scenes
    .map((scene) => {
      const project = primaryProject(scene, bySlug)
      if (!project) return null
      const related = scene.projectSlugs
        .filter((s) => s !== project.slug)
        .map((s) => bySlug.get(s))
        .filter((p): p is Project => !!p)
      return { scene, project, related }
    })
    .filter((x): x is { scene: Scene; project: Project; related: Project[] } => !!x)

  // 首屏固定一个场景、不轮播（§3）。首选 heroSceneId；它还没有真实成果、而别的场景有，
  // 就换成证据最齐全的那个；都没有时仍用首选，右侧显示文字版的输入 → 输出对照
  const preferred = shown.find((s) => s.scene.id === heroSceneId)
  const hero =
    preferred && hasEvidence(preferred.project)
      ? preferred
      : (shown.find((s) => hasEvidence(s.project)) ?? preferred ?? shown[0])

  const inScenes = new Set(shown.map((s) => s.project.slug))
  const others = all.filter((p) => !inScenes.has(p.slug))
  // 有封面的排前面（没有封面的卡片夹在中间会撑出空白）；sort 是稳定的，各自保持原顺序
  others.sort((a, b) => Number(!!b.cover) - Number(!!a.cover))

  return (
    <RevealRoot>
      {/* ① 首屏：左边说清用途（约四成），右边一个固定场景的真实输入输出（约六成）。手机上按 用途 → 按钮 → 成果 排 */}
      <header id="top" className="home-hero">
        <div className="wrap home-hero-grid">
          <div className="home-hero-copy">
            <h1>把视频和资料，变成可查看的 AI 成果</h1>
            <p className="home-hero-desc">
              培训视频整理、讲解视频制作、表达反馈。先看我们搭建的场景演示，再一起评估你的素材、输出要求和业务流程。
            </p>
            <div className="home-hero-actions">
              <Link className="btn-primary btn-md" href="/#scenes">
                查看场景演示 <ArrowRight size={16} />
              </Link>
              <ConsultationTrigger className="btn-ghost btn-md" context={{ source: "hero", intent: "demand", mode: "consult" }}>
                聊聊我的场景
              </ConsultationTrigger>
            </div>
          </div>
          {hero && <HeroEvidence scene={hero.scene} project={hero.project} />}
        </div>
      </header>

      {/* ② 场景入口：只是一排跳转链接，点了滚到下面对应的展示区 */}
      <section id="scenes" className="home-section home-scenes">
        <div className="wrap">
          <div className="home-head reveal">
            <h2>场景演示</h2>
            <p>找到和你相近的任务，看实际的输入、输出和适用范围。</p>
          </div>
          {shown.length > 0 ? (
            <ol className="scene-nav" aria-label="场景">
              {shown.map(({ scene }, i) => (
                <li key={scene.id}>
                  <a href={`#scene-${scene.id}`}>
                    <span className="scene-nav-index">{i + 1}</span>
                    {scene.nav}
                    <ArrowRight size={15} aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-note">演示资料正在整理，可以先通过页面底部直接联系团队。</p>
          )}
          {/* ③ 重点演示：一个场景一个上下排列的大展示区 */}
          <div className="scene-list">
            {shown.map(({ scene, project, related }, i) => (
              <SceneBlock key={scene.id} scene={scene} project={project} related={related} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* 其余作品收在这里：普通卡片，不再和重点演示抢位置 */}
      {others.length > 0 && (
        <section id="more" className="home-section home-more">
          <div className="wrap">
            <div className="home-head reveal">
              <h2>更多作品</h2>
              <p>团队做过的其他工具。标有「功能示意」的封面是说明图，不是运行截图。</p>
            </div>
            <div className="proj-grid">
              {others.map((p) => (
                <ProjectCard key={p.slug} project={p} source="list" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ④ 合作方式：交付形式、费用构成、评估步骤直接摊开（以前折叠在 FAQ 里）。
          三种合作形式上线前要逐项核实能承接（config/showcase.ts 的注释） */}
      <section id="cooperation" className="home-section">
        <div className="wrap">
          <div className="home-head reveal">
            <h2>这个演示，怎样用于你的业务？</h2>
            <p>先看你的样例效果，再确定范围。下面是可以沟通的三种合作形式。</p>
          </div>
          <div className="coop-table reveal" role="table" aria-label="合作形式">
            <div className="coop-row coop-row-head" role="row">
              <span role="columnheader">合作形式</span>
              <span role="columnheader">你可能得到</span>
              <span role="columnheader">需要先评估</span>
            </div>
            {cooperationForms.map((f) => (
              <div className="coop-row" role="row" key={f.title}>
                <b role="rowheader">{f.title}</b>
                <span role="cell">
                  <i className="coop-label">你可能得到：</i>
                  {f.get}
                </span>
                <span role="cell">
                  <i className="coop-label">需要先评估：</i>
                  {f.assess}
                </span>
              </div>
            ))}
          </div>
          <div className="coop-bottom">
            <div className="coop-fee reveal">
              <h3>费用怎么算</h3>
              <p>
                根据项目范围，费用可能包含素材整理、开发适配、部署、模型调用、人工审核和后续维护。具体适用项在方案中列明。
              </p>
            </div>
            <div className="coop-steps reveal">
              <h3>评估怎么进行</h3>
              <ol>
                {cooperationSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="field-hint">核心团队负责首次沟通和可行性评估，具体交付和维护负责人在合作方案中明确。</p>
            </div>
          </div>
          <details id="faq" className="platform-details">
            <summary>提交、登录与资料处理的常见问题</summary>
            <div className="platform-details-body">
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

      {/* ⑤ 核心团队：一个统一的对外身份，只写真实职责（用户 2026-10-19：先不写人名） */}
      <section id="team" className="home-section">
        <div className="wrap">
          <div className="home-head reveal">
            <h2>由同一个核心团队，负责沟通与评估</h2>
            <p>我们用自己搭建的演示验证具体任务，再根据你的素材和要求判断合作范围。</p>
          </div>
          <div className="team-grid">
            {teamRoles.map((r) => (
              <article className="team-card reveal" key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </article>
            ))}
            {shown.length > 0 && (
              <article className="team-card team-card-wide reveal">
                <h3>演示里做了什么</h3>
                <ul>
                  {shown.map(({ scene }) => (
                    <li key={scene.id}>
                      <b>{scene.nav}：</b>
                      {scene.origin.note}
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>
        </div>
      </section>

      {/* ⑥ 页尾咨询：两类访客两个起点，外加始终可用的微信。
          微信卡是服务端渲染的，JS 没加载也能看到微信号；邮箱没配置时整张卡不出现 */}
      <section id="contact" className="home-section home-contact">
        <div className="wrap">
          <div className="home-head reveal">
            <h2>联系团队</h2>
            <p>还在了解，或已经有明确项目，都可以从这里开始。浏览不用登录，提交时需要手机号登录。</p>
          </div>
          <div className="contact-starts">
            <article className="contact-start reveal">
              <h3>还在了解</h3>
              <p>选一下场景和进度、留个联系方式，团队会联系你一起看是否适合。</p>
              <ConsultationTrigger className="btn-primary btn-md" context={{ source: "contact", intent: "demand", mode: "consult" }}>
                聊聊我的场景 <ArrowRight size={16} />
              </ConsultationTrigger>
            </article>
            <article className="contact-start reveal">
              <h3>已有明确项目</h3>
              <p>写清现在的问题、期望结果、预算和时间，团队评估得更快。</p>
              <Link className="btn-ghost btn-md" href="/requests/new">
                填写完整需求 <ArrowUpRight size={16} />
              </Link>
            </article>
          </div>
          <div className={`platform-contact-grid${contactConfig.email ? "" : " single"}`}>
            <ConsultationCard context={{ source: "contact", intent: "demand" }} compact />
            {contactConfig.email && <EmailCard email={contactConfig.email} />}
          </div>
        </div>
      </section>
    </RevealRoot>
  )
}
