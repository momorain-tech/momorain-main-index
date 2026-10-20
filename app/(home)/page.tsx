import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import { getHomeProjects, type Project } from "@/lib/projects"
import { OUTPUT_KIND_LABELS, inputOutputs, resultOutputs, type CaseOutput } from "@/lib/project-content"
import { projectConsultContext } from "@/lib/project-url"
import { siteConfig } from "@/config/site"
import { platformNavigation, projectScenarios, providerJoin } from "@/config/platform"
import { contactConfig } from "@/config/contact"
import { faqs } from "@/config/home"
import {
  IMPLEMENTATION_LABELS,
  ORIGIN_LABELS,
  cooperationForms,
  cooperationSteps,
  heroSceneId,
  scenes,
  teamRoles,
  type Scene,
} from "@/config/showcase"
import { CopyButton } from "@/components/account/copy-button"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import { displayModes, hasEvidence, primaryProject } from "@/components/showcase/scene-parts"
import { NeonReveal } from "./v4-motion"
import { V4Nav } from "./v4-nav"
import s from "./v4.module.css"

// 正式首页：沉浸式暗色霓虹（2026-10-15 定稿的视觉）+ 第四版内容（2026-10-19）。
//
// 视觉（外壳、导航、动效、配色、卡片样式）保持 2026-10-15 的暗色霓虹不变（用户 2026-10-21 要求）；
// 内容按第四版改版建议换成「场景 → 成果 → 合作 → 团队 → 咨询」：
//   #top 首屏（用途 + 一个固定场景的输入输出）
//   #scenes 01 场景演示（场景导航 + 每个场景一个大展示区 #scene-<id>）
//   #more 02 更多作品 → #cooperation 03 合作方式（含折叠的 #faq）→ #team 04 核心团队 → #contact 联系团队
//
// - 场景内容在 config/showcase.ts（作品详情页共用同一份）；真实成果只从后台案例内容读，
//   没录入就显示「样例整理中」，不拿示意图、宣传封面冒充成果
// - 二级页面保持浅色清新风格（(public)/layout），本页只负责首页
// - 旧锚点（#platform、#services、#projects、#shelf…）由 v4-motion.tsx 映射到新区块
export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — 把视频和资料，变成可查看的 AI 成果` },
  description: siteConfig.description,
}
// ISR：构建时生成静态页，之后每 5 分钟按数据库最新数据重新生成；后台改项目会立即刷新。
// 登录状态和咨询表单都在客户端组件里自己取，不会让这一页变成每次访问都查库
export const revalidate = 300

// 跑马灯：只放我们有演示或能沟通的事，不放没做过的方向（第三版那串「AI 财务」「AI 客销」删了）
const marqueeWords = [
  "培训视频整理",
  "分步图文教程",
  "讲解视频制作",
  "逐字稿配音",
  "白板手绘动画",
  "口播表达反馈",
  "演讲练习",
  "流程适配",
  "工具开发与部署",
]

export default async function HomePage() {
  const { all } = await getHomeProjects()
  const bySlug = new Map(all.map((p) => [p.slug, p]))

  // 只展示主作品已发布的场景（不能把人带到 404）；场景里其余已发布的作品列为「同场景作品」
  const shown = scenes
    .map((scene) => {
      const project = primaryProject(scene, bySlug)
      if (!project) return null
      const related = scene.projectSlugs
        .filter((slug) => slug !== project.slug)
        .map((slug) => bySlug.get(slug))
        .filter((p): p is Project => !!p)
      return { scene, project, related }
    })
    .filter((x): x is { scene: Scene; project: Project; related: Project[] } => !!x)

  // 首屏固定一个场景、不轮播。首选 heroSceneId；它还没有真实成果、别的场景有，就换成有成果的那个
  const preferred = shown.find((x) => x.scene.id === heroSceneId)
  const hero =
    preferred && hasEvidence(preferred.project)
      ? preferred
      : (shown.find((x) => hasEvidence(x.project)) ?? preferred ?? shown[0])

  // 其余作品进「更多作品」：有封面的排前面（sort 稳定，各自保持后台的顺序）
  const inScenes = new Set(shown.map((x) => x.project.slug))
  const others = all.filter((p) => !inScenes.has(p.slug)).sort((a, b) => Number(!!b.cover) - Number(!!a.cover))

  const anchors = platformNavigation.map((n) => ({ ...n, href: `#${n.href.split("#")[1]}` }))

  return (
    <NeonReveal>
      <div className={s.page}>
        <V4Nav />

        {/* ① 首屏：左边说清用途，右边一个固定场景的真实输入输出（手机上 用途 → 按钮 → 成果） */}
        <header id="top" className={s.hero}>
          <div className={s.heroGrid} />
          <div className={`${s.orbWrap} ${s.orb1}`} data-orb="0.16">
            <div className={s.orb} />
          </div>
          <div className={`${s.orbWrap} ${s.orb2}`} data-orb="0.1">
            <div className={s.orb} />
          </div>
          <div className={`${s.orbWrap} ${s.orb3}`} data-orb="0.06">
            <div className={s.orb} />
          </div>
          <div className={s.heroSplit}>
            <div className={s.heroCopy}>
              <div className={s.heroKicker} data-reveal>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/brand/dujiao-gravity-logo.png" alt="" className={s.logoImgSm} />
                momorain · {siteConfig.name}
              </div>
              {/* 两行各自不折行（宽屏）：「AI 成果」不会被拆到两行 */}
              <h1 className={s.heroTitleWrap} data-reveal>
                <span className={s.titleLine}>把视频和资料，</span>
                <span className={s.titleLine}>
                  变成<span className={s.grad}>可查看的 AI 成果</span>
                </span>
              </h1>
              <p className={s.heroDesc} data-reveal>
                培训视频整理、讲解视频制作、表达反馈。先看我们搭建的场景演示，再一起评估你的素材、输出要求和业务流程。
              </p>
              <div className={s.heroCtasLeft} data-reveal>
                <a href="#scenes" className={`${s.btn} ${s.btnPrimary}`} data-magnetic>
                  查看场景演示 <ArrowRight size={16} />
                </a>
                <span data-magnetic>
                  <ConsultationTrigger
                    className={`${s.btn} ${s.btnGhost}`}
                    context={{ source: "hero", intent: "demand", mode: "consult" }}
                  >
                    聊聊我的场景
                  </ConsultationTrigger>
                </span>
              </div>
            </div>
            {hero && <HeroEvidence scene={hero.scene} project={hero.project} />}
          </div>
          <div className={s.scrollCue} aria-hidden="true">
            SCROLL
            <i />
          </div>
        </header>

        <div className={s.marquee} aria-hidden="true">
          <div className={s.marqueeTrack}>
            {[0, 1].map((half) => (
              <div className={s.marqueeItem} key={half}>
                {marqueeWords.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ② 场景演示：上面一排跳转链接（只负责导航，不再做宣传大卡），下面每个场景一个大展示区 */}
        <section id="scenes" className={s.section}>
          <SecHead num="01" title="场景演示" />
          <p className={s.secDesc} data-reveal>
            找到和你相近的任务，看实际的输入、输出和适用范围。
          </p>
          {shown.length > 0 ? (
            <ol className={s.sceneNav} aria-label="场景" data-reveal>
              {shown.map(({ scene }, i) => (
                <li key={scene.id}>
                  <a href={`#scene-${scene.id}`}>
                    <span className={s.sceneNavIndex}>{String(i + 1).padStart(2, "0")}</span>
                    {scene.nav}
                    <ArrowRight size={15} aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className={s.secDesc}>演示资料正在整理，可以先通过页面底部直接联系团队。</p>
          )}
          <div className={s.sceneList}>
            {shown.map(({ scene, project, related }, i) => (
              <SceneBlock key={scene.id} scene={scene} project={project} related={related} index={i} />
            ))}
          </div>
        </section>

        {/* ③ 更多作品：2026-10-15 的统一网格卡片原样保留 */}
        {others.length > 0 && (
          <section id="more" className={s.section}>
            <SecHead num="02" title="更多作品" />
            <p className={s.secDesc} data-reveal>
              团队做过的其他工具。标有「功能示意」的封面是说明图，不是运行截图。
            </p>
            <div className={s.demoGrid}>
              {others.map((p, i) => (
                <CaseCard key={p.slug} project={p} index={i + 1} />
              ))}
            </div>
          </section>
        )}

        {/* ④ 合作方式：交付形式、费用构成、评估步骤直接摊开（以前折叠在 FAQ 里）。
            三种合作形式上线前要逐项核实能承接（见 config/showcase.ts） */}
        <section id="cooperation" className={s.section}>
          <SecHead num="03" title="合作方式" />
          <h3 className={s.leadTitle} data-reveal>
            这个演示，怎样用于<span className={s.grad}>你的业务</span>？
          </h3>
          <p className={s.secDesc} data-reveal>
            先看你的样例效果，再确定范围。下面是可以沟通的三种合作形式。
          </p>
          <div className={s.coopGrid}>
            {cooperationForms.map((f, i) => (
              <article key={f.title} className={`${s.serviceCard}${i === 1 ? ` ${s.serviceCyan}` : ""}`} data-reveal>
                <span className={s.serviceRole}>{String(i + 1).padStart(2, "0")}</span>
                <h4 className={s.coopTitle}>{f.title}</h4>
                <dl className={s.coopDl}>
                  <dt>你可能得到</dt>
                  <dd>{f.get}</dd>
                  <dt>需要先评估</dt>
                  <dd>{f.assess}</dd>
                </dl>
              </article>
            ))}
          </div>
          <div className={s.coopBottom}>
            <div className={s.glassPanel} data-reveal>
              <h4 className={s.panelTitle}>费用怎么算</h4>
              <p className={s.panelText}>
                根据项目范围，费用可能包含素材整理、开发适配、部署、模型调用、人工审核和后续维护。具体适用项在方案中列明。
              </p>
            </div>
            <div className={s.glassPanel} data-reveal>
              <h4 className={s.panelTitle}>评估怎么进行</h4>
              <ol className={s.stepList}>
                {cooperationSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className={s.panelNote}>核心团队负责首次沟通和可行性评估，具体交付和维护负责人在合作方案中明确。</p>
            </div>
          </div>
          {/* 常见问题：仍是一个大折叠面板（默认收起），id="faq" 保留，旧链接 #faq 仍能对上 */}
          <details id="faq" className={s.faqBlock} data-reveal>
            <summary>提交、登录与资料处理的常见问题</summary>
            <div className={s.faqBody}>
              <div className={s.faqList}>
                {faqs.map((f) => (
                  <details className={s.faqItem} key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </details>
        </section>

        {/* ⑤ 核心团队：一个统一的对外身份（四个服务方展示身份已合并），只写真实职责，不写人名 */}
        <section id="team" className={s.section}>
          <SecHead num="04" title="核心团队" />
          <h3 className={s.leadTitle} data-reveal>
            由<span className={s.grad}>同一个核心团队</span>，负责沟通与评估
          </h3>
          <p className={s.secDesc} data-reveal>
            我们用自己搭建的演示验证具体任务，再根据你的素材和要求判断合作范围。
          </p>
          <div className={s.teamGrid}>
            {teamRoles.map((r, i) => (
              <article key={r.title} className={s.providerCard} data-reveal>
                <div className={s.providerTop}>
                  <span className={s.mono}>{i + 1}</span>
                  <div className={s.providerName}>{r.title}</div>
                </div>
                <p className={s.providerIntro}>{r.text}</p>
              </article>
            ))}
          </div>
          {shown.length > 0 && (
            <div className={`${s.glassPanel} ${s.teamWork}`} data-reveal>
              <h4 className={s.panelTitle}>演示里做了什么</h4>
              <ul className={s.workList}>
                {shown.map(({ scene }) => (
                  <li key={scene.id}>
                    <b>{scene.nav}</b>
                    <span>{scene.origin.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ⑥ 联系团队：两类访客两个起点（轻量咨询 / 完整需求），微信始终可用。
            二维码和微信号是服务端渲染的，JS 没加载也能看到 */}
        <section id="contact" className={s.section}>
          <div className={s.contactPanel} data-reveal>
            <div className={s.contactGlow} />
            <div>
              <h2 className={s.contactTitle}>
                联系<span className={s.grad}>核心团队</span>
              </h2>
              <p className={s.contactText}>还在了解，或已经有明确项目，都可以从这里开始。浏览不用登录，提交时需要手机号登录。</p>
              <div className={s.contactStarts}>
                <div className={s.contactStart}>
                  <b>还在了解</b>
                  <span>选一下场景和进度、留个联系方式，团队联系你一起看是否适合。</span>
                  <span data-magnetic>
                    <ConsultationTrigger
                      className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                      context={{ source: "contact", intent: "demand", mode: "consult" }}
                    >
                      聊聊我的场景 <ArrowRight size={16} />
                    </ConsultationTrigger>
                  </span>
                </div>
                <div className={s.contactStart}>
                  <b>已有明确项目</b>
                  <span>写清现在的问题、期望结果、预算和时间，团队评估得更快。</span>
                  <Link href="/requests/new" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} data-magnetic>
                    填写完整需求 <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
            <div className={s.qrCard}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 二维码保留原图，手机上才能长按识别 */}
              <img src={contactConfig.wechatQr} alt={`微信二维码，微信号 ${contactConfig.wechatId}`} />
              <div className={s.qrId}>
                {contactConfig.wechatId}
                <CopyButton text={contactConfig.wechatId} />
              </div>
              <div className={s.qrNote}>不想填表？直接加微信联系。{contactConfig.note}</div>
            </div>
          </div>
        </section>

        <footer className={s.footer}>
          <div className={s.footerBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/dujiao-gravity-logo.png" alt="" className={s.logoImg} />
            <div>
              <div>
                {siteConfig.name} · {siteConfig.brand}
              </div>
              <div className={s.footerSlogan}>先看真实成果，再一起评估你的场景</div>
              {/* 微信纯文本兜底：微信内置浏览器 JS 失败时，这一行是唯一能看到的联系方式 */}
              <div className={s.footerWechat}>微信联系：{contactConfig.wechatId}</div>
            </div>
          </div>
          <div className={s.footerLinks}>
            {anchors.map((a) => (
              <a key={a.href} href={a.href}>
                {a.label}
              </a>
            ))}
            {/* 服务方合作入口（第四版从首页主线移到页脚） */}
            <Link href={providerJoin.href}>{providerJoin.label}</Link>
            <a href={siteConfig.links.github} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </div>
          <div>© 2026 {siteConfig.brand}</div>
        </footer>
      </div>
    </NeonReveal>
  )
}

function SecHead({ num, title }: { num: string; title: string }) {
  return (
    <div className={s.secHead} data-reveal>
      <span className={s.secNum}>{num}</span>
      <h2 className={s.secTitle}>{title}</h2>
      <div className={s.secLine} />
    </div>
  )
}

// ─── 成果 ────────────────────────────────────────────────────────
// 图片默认只露出上半截清晰的局部（长教程缩成一整张会小到看不清），点开看全图；
// 视频不自动播放、preload="none"，点了才开始下载
function Media({ item }: { item: CaseOutput }) {
  if (item.type === "image") {
    return (
      <a className={s.media} href={item.url} target="_blank" rel="noreferrer" aria-label={`查看全图：${item.caption}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 成果图可能是站外 https 地址 */}
        <img src={item.url} alt={item.caption} loading="lazy" />
        <span className={s.mediaEnlarge}>查看全图 ↗</span>
      </a>
    )
  }
  if (item.type === "video") {
    return (
      <div className={s.mediaVideo}>
        <video src={item.url} poster={item.poster} controls preload="none" playsInline>
          你的浏览器不能播放这个视频。
        </video>
        <a className={s.mediaLink} href={item.url} target="_blank" rel="noreferrer">
          无法播放？直接打开视频 ↗
        </a>
      </div>
    )
  }
  return (
    <a className={s.mediaLink} href={item.url} target="_blank" rel="noreferrer">
      查看文件 ↗
    </a>
  )
}

function Caption({ item }: { item: CaseOutput }) {
  return (
    <p className={s.ioCaption}>
      <span className={`${s.kindTag}${item.kind === "revised" ? ` ${s.kindRevised}` : ""}`}>
        {OUTPUT_KIND_LABELS[item.kind]}
      </span>
      {item.caption}
    </p>
  )
}

// 成果旁边的说明：演示来源 · 本样例的处理范围 · 人工修改了哪些
function EvidenceNote({ scene, project }: { scene: Scene; project: Project }) {
  const c = project.caseContent
  return (
    <p className={s.evidenceNote}>
      <b>{ORIGIN_LABELS[scene.origin.kind]}</b>
      {c?.input && <> · 本样例的处理范围：{c.input}</>} · 人工修改：{c?.manualEdits || "未注明"}
    </p>
  )
}

// 首屏右侧：有真实成果 → 同一份样例的「输入 | 实际输出」并排；没有 → 文字版的输入 → 输出
function HeroEvidence({ scene, project }: { scene: Scene; project: Project }) {
  const results = resultOutputs(project.caseContent)
  const inputs = inputOutputs(project.caseContent)
  return (
    <figure className={s.heroPanel} data-reveal>
      <span className={s.panelKicker}>{scene.title}</span>
      {results.length ? (
        <div className={s.ioMedia}>
          <div>
            <h3 className={s.ioLabel}>输入</h3>
            {inputs[0] ? (
              <>
                <Media item={inputs[0]} />
                <p className={s.ioCaption}>{inputs[0].caption}</p>
              </>
            ) : (
              <p className={s.ioText}>{project.caseContent?.input ?? scene.input.prepare[0]}</p>
            )}
          </div>
          <div>
            <h3 className={s.ioLabel}>实际输出</h3>
            <Media item={results[0]} />
            <Caption item={results[0]} />
          </div>
        </div>
      ) : (
        <div className={s.ioText2}>
          <div>
            <h3 className={s.ioLabel}>你提供</h3>
            <ul className={s.ioList}>
              {scene.input.prepare.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <ArrowRight className={s.ioArrow} size={22} aria-hidden />
          <div>
            <h3 className={s.ioLabel}>你会得到</h3>
            <p className={s.ioText}>{scene.output}</p>
          </div>
        </div>
      )}
      <figcaption>
        {results.length ? (
          <EvidenceNote scene={scene} project={project} />
        ) : (
          <p className={s.evidenceNote}>
            <b>{ORIGIN_LABELS[scene.origin.kind]}</b> · 真实样例整理中：这里只放同一份输入对应的真实产物，不用示意图代替。
          </p>
        )}
        <Link className={s.textLink} href={`/projects/${project.slug}${results.length ? "#outputs" : ""}`}>
          {results.length ? "查看完整样例" : `先了解「${project.name}」`} →
        </Link>
      </figcaption>
    </figure>
  )
}

// ─── 重点演示：一个场景一个大展示区 ──────────────────────────────────
// 默认露出：成果、你需要准备、关键限制；处理过程和完整的适用范围折叠起来（避免首页过长）
function SceneBlock({
  scene,
  project,
  related,
  index,
}: {
  scene: Scene
  project: Project
  related: Project[]
  index: number
}) {
  const results = resultOutputs(project.caseContent)
  const modes = displayModes(project)
  const consult = { ...projectConsultContext(project, "scene"), scene: scene.consultScene }
  return (
    <article id={`scene-${scene.id}`} className={s.sceneBlock} aria-labelledby={`scene-${scene.id}-title`}>
      <header className={s.sceneHead} data-reveal>
        <span className={s.sceneNum}>{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3 id={`scene-${scene.id}-title`} className={s.sceneTitle}>
            {scene.title}
          </h3>
          <div className={s.badges}>
            <span className={s.chip}>{IMPLEMENTATION_LABELS[scene.implementation]}</span>
            {modes.length ? (
              modes.map((m) => (
                <span key={m} className={`${s.chip} ${s.chipCyan}`}>
                  {m}
                </span>
              ))
            ) : (
              <span className={`${s.chip} ${s.chipAmber}`}>样例整理中</span>
            )}
            <span className={`${s.chip} ${s.chipLine}`}>{ORIGIN_LABELS[scene.origin.kind]}</span>
          </div>
        </div>
      </header>

      <div className={s.sceneGrid}>
        <div className={s.scenePanel} data-reveal>
          {results.length ? (
            <>
              <Media item={results[0]} />
              <Caption item={results[0]} />
              <p className={s.ioSource}>来源：{results[0].source}</p>
              <EvidenceNote scene={scene} project={project} />
            </>
          ) : (
            <div className={s.sceneEmpty}>
              <span className={s.panelKicker}>会得到</span>
              <p className={s.sceneOutput}>{scene.output}</p>
              <p className={s.panelNote}>真实样例整理中。这里只放真实产物，素材到位前不用示意图代替。</p>
            </div>
          )}
        </div>

        <div className={s.sceneFacts} data-reveal>
          <Fact title="任务">
            <p>
              适合{scene.task.audience}。原来：{scene.task.before}
            </p>
          </Fact>
          <Fact title="你需要准备">
            <ul>
              {scene.input.prepare.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Fact>
          <Fact title="关键限制">
            <p>{scene.boundary.assess[0]}</p>
          </Fact>
          <details className={s.factMore}>
            <summary>处理过程与适用范围</summary>
            <FactList title="自动完成" items={scene.process.automated} />
            <FactList title="人工处理" items={scene.process.manual} />
            <FactList title="已经验证" items={scene.boundary.verified} />
            <FactList title="仍需评估" items={scene.boundary.assess} />
            <p className={s.panelNote}>{scene.origin.note}</p>
          </details>
          <div className={s.sceneActions}>
            <Link
              href={`/projects/${project.slug}${results.length ? "#outputs" : ""}`}
              className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
              data-magnetic
            >
              {results.length ? "查看完整样例" : `了解「${project.name}」`} <ArrowUpRight size={16} />
            </Link>
            <span data-magnetic>
              <ConsultationTrigger className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} context={consult}>
                我也有类似情况
              </ConsultationTrigger>
            </span>
          </div>
          {related.length > 0 && (
            <p className={s.sceneRelated}>
              同场景作品：
              {related.map((r, i) => (
                <span key={r.slug}>
                  {i > 0 && "、"}
                  <Link href={`/projects/${r.slug}`}>{r.name}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.fact}>
      <h4>{title}</h4>
      {children}
    </div>
  )
}
function FactList({ title, items }: { title: string; items: string[] }) {
  return (
    <Fact title={title}>
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </Fact>
  )
}

// 作品卡片（2026-10-15 样式不变）：封面（或缺省光晕）+ 编号 + 标签 + 名称 + 简介 + 入口。
// 第四版：不再署服务方名字（统一是核心团队）；「查看成果」只认真实成果，原始素材不算
function CaseCard({ project, index }: { project: Project; index: number }) {
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
    <article className={s.caseCard} data-reveal>
      <Link href={href} className={s.caseMedia} tabIndex={-1} aria-hidden="true">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 封面可能是站外 https 地址
          <img src={cover.url} alt="" loading="lazy" />
        ) : (
          <div className={s.caseFallback}>{project.icon}</div>
        )}
      </Link>
      <span className={s.caseNum}>{String(index).padStart(2, "0")}</span>
      {cover && "kind" in cover && cover.kind === "illustration" && <span className={s.caseKind}>功能示意</span>}
      <div className={s.caseBody}>
        {tags.length > 0 && (
          <div className={s.caseTags}>
            {tags.slice(0, 2).map((t) => (
              <span className={s.chip} key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
        <h3 className={s.caseName}>
          <span aria-hidden="true">{project.icon}</span>
          {project.name}
        </h3>
        <p className={s.caseDesc}>{project.desc}</p>
        <div className={s.caseMeta}>
          <span>核心团队</span>
          <Link href={href} className={s.caseGo}>
            {results.length ? "查看成果" : "了解作品"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
