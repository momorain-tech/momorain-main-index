import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { getHomeProjects, type Project } from "@/lib/projects"
import { siteConfig } from "@/config/site"
import {
  participationPaths,
  platformNavigation,
  providers,
  providerMonogram,
  projectProvider,
  projectScenarios,
} from "@/config/platform"
import { contactConfig } from "@/config/contact"
import { faqs } from "@/config/home"
import { CopyButton } from "@/components/account/copy-button"
import { NeonReveal } from "./v4-motion"
import { V4Nav } from "./v4-nav"
import s from "./v4.module.css"

// 正式首页：沉浸式暗色霓虹（2026-10-14 方向确认，2026-10-15 由 /v4 预览页迁为正式首页）。
// - 内容全部复用真实数据源（getHomeProjects / participationPaths / providers / contactConfig）
// - 二级页面保持浅色清新风格（(public)/layout），本页只负责首页
// - 旧首页备份在 /old（app/(public)/old/page.tsx），迁移说明见 docs/V4_HOMEPAGE_MIGRATION.md
// - Demo 展示是统一网格（用户定稿），不再区分精选大卡；如恢复精选规则参考旧首页实现
export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — 让 AI 能力落到真实业务` },
  description: siteConfig.description,
}
export const revalidate = 300

const marqueeWords = [
  "AI 客销",
  "AI 财务",
  "智能工作流",
  "企业知识库",
  "定制化 Agent",
  "AI 能力培训",
  "AI 业务咨询",
  "视频生成",
  "语音交互",
  "表达训练",
  "内容生产工具",
  "部署与运维",
]

// 原型：Demo 展示区 2026-10-15 起统一网格（用户要求卡片大小一致，取消精选大卡）。
// 正式替换首页时再决定是否恢复精选大卡规则（真实截图封面 + 有成果 + 不进高曝光排除名单）
export default async function V4Page() {
  const { all } = await getHomeProjects()

  const anchors = platformNavigation.map((n) => ({
    ...n,
    href: `#${n.href.split("#")[1]}`,
  }))

  return (
    <NeonReveal>
      <div className={s.page}>
        {/* 顶部导航：登录/用户入口、汉堡菜单、咨询 CTA 与线上导航对齐（明暗切换刻意不接，v4 只有暗色） */}
        <V4Nav />

        {/* ① 首屏 */}
        <header id="platform" className={s.hero}>
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
          <div className={s.heroInner}>
            <div className={s.heroKicker} data-reveal>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/brand/dujiao-gravity-logo.png" alt="" className={s.logoImgSm} />
              momorain · {siteConfig.name}
            </div>
            <h1 className={s.heroTitle} data-reveal>
              让 <span className={s.grad}>AI 能力</span> 落到 <span className={s.grad}>真实业务</span>
            </h1>
            <p className={s.heroDesc} data-reveal>
              {siteConfig.description}
            </p>
            <div className={s.heroCtas} data-reveal>
              <Link href="/requests/new" className={`${s.btn} ${s.btnPrimary}`} data-magnetic>
                提交需求 <ArrowRight size={16} />
              </Link>
              <a href="#projects" className={`${s.btn} ${s.btnGhost}`} data-magnetic>
                看看作品
              </a>
            </div>
            <div className={s.heroStats} data-reveal>
              {/* data-count = 滚动目标值：客户端从 0 滚到它（见 v4-motion.tsx），SSR 直接输出最终值，
                  JS 不可用时统计也是正确的 */}
              <div className={s.stat}>
                <b data-count={all.length}>{all.length}</b>
                <span>个作品 Demo</span>
              </div>
              <div className={s.stat}>
                <b data-count={providers.length}>{providers.length}</b>
                <span>位服务方</span>
              </div>
              <div className={s.stat}>
                <b data-count={2}>2</b>
                <span>类参与身份</span>
              </div>
            </div>
          </div>
          <div className={s.scrollCue} aria-hidden="true">
            SCROLL
            <i />
          </div>
        </header>

        {/* 场景跑马灯 */}
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

        {/* ② 服务内容 */}
        <section id="services" className={s.section}>
          <div className={s.secHead} data-reveal>
            <span className={s.secNum}>02</span>
            <h2 className={s.secTitle}>服务内容</h2>
            <div className={s.secLine} />
          </div>
          <div className={s.serviceGrid}>
            {participationPaths.map((path, i) => (
              <article
                key={path.role}
                className={`${s.serviceCard}${i === 1 ? ` ${s.serviceCyan}` : ""}`}
                data-reveal
              >
                <span className={s.serviceRole}>{path.role}</span>
                <h3 className={s.serviceTitle}>{path.title}</h3>
                <p className={s.serviceDesc}>{path.description}</p>
                <div className={s.serviceAction}>
                  <Link
                    href={path.href}
                    className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                    data-magnetic
                  >
                    {path.action} <ArrowUpRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {/* 合作说明与常见问题：处理方式与旧首页一致——一个大折叠面板（默认收起），
              展开后是说明段落 + 7 条子折叠；id="faq" 保留，旧链接 #faq 仍能对上 */}
          <details id="faq" className={s.faqBlock} data-reveal>
            <summary>合作说明与常见问题</summary>
            <div className={s.faqBody}>
              <p className={s.faqIntro}>
                提交的需求和服务资料会保存在平台后台，由专人跟进；需求还可以选择让 AI
                做一次初步分析，辅助判断方向。方案、报价、人选和合作范围由双方沟通后确认，提交不代表订单或审核通过。
              </p>
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

        {/* ③ Demo 展示 */}
        <section id="projects" className={s.section}>
          <div className={s.secHead} data-reveal>
            <span className={s.secNum}>03</span>
            <h2 className={s.secTitle}>Demo 展示</h2>
            <div className={s.secLine} />
          </div>
          <p className={s.secDesc} data-reveal>
            通过真实作品了解 AI 能解决的实际问题、使用条件和背后的服务能力。
          </p>
          <div className={s.demoGrid}>
            {all.map((p, i) => (
              <CaseCard key={p.slug} project={p} index={i + 1} />
            ))}
          </div>
        </section>

        {/* 服务方横排 */}
        <section className={s.section} style={{ paddingTop: "2rem" }}>
          <div className={s.secHead} data-reveal>
            <span className={s.secNum}>✦</span>
            <h2 className={s.secTitle}>服务方</h2>
            <div className={s.secLine} />
          </div>
          <div className={s.providerRow}>
            {providers.map((p) => (
              <Link key={p.slug} href={`/providers/${p.slug}`} className={s.providerCard} data-reveal>
                <div className={s.providerTop}>
                  <span className={s.mono}>{providerMonogram(p)}</span>
                  <div>
                    <div className={s.providerName}>{p.name}</div>
                    <div className={s.providerType}>{p.type}</div>
                  </div>
                </div>
                <p className={s.providerIntro}>{p.intro}</p>
                <div className={s.dirChips}>
                  {p.directions.slice(0, 3).map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ④ 联系方式 */}
        <section id="contact" className={s.section}>
          <div className={s.contactPanel} data-reveal>
            <div className={s.contactGlow} />
            <div>
              <h2 className={s.contactTitle}>
                开始一段 <span className={s.grad}>AI 合作</span>
              </h2>
              <p className={s.contactText}>
                提交需求或服务资料请到「服务内容」区块，平台会先做初步分析，再由专人与你对接。方案、报价、人选和合作范围由双方沟通后确认。
              </p>
              <a href="#services" className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} data-magnetic>
                去服务内容 <ArrowRight size={16} />
              </a>
            </div>
            <div className={s.qrCard}>
              {/* 二维码是站内静态文件，next/image 直接可用；沿用 img 是为了和现有页面保持一致 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={contactConfig.wechatQr} alt="微信二维码" />
              <div className={s.qrId}>
                {contactConfig.wechatId}
                {/* 复制按钮复用账号页的 CopyButton（含 clipboard 降级，见 lib/clipboard.ts） */}
                <CopyButton text={contactConfig.wechatId} />
              </div>
              {contactConfig.note && <div className={s.qrNote}>{contactConfig.note}</div>}
            </div>
          </div>
        </section>

        {/* 页脚：对齐线上——品牌 + 微信纯文本兜底 + 主导航链接 + GitHub */}
        <footer className={s.footer}>
          <div className={s.footerBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/dujiao-gravity-logo.png" alt="" className={s.logoImg} />
            <div>
              <div>
                {siteConfig.name} · {siteConfig.brand}
              </div>
              {/* 与二级页页脚同款：标语 + 微信纯文本兜底（微信内置浏览器 JS 失败时唯一的联系方式） */}
              <div className={s.footerSlogan}>让 AI 能力落到真实业务</div>
              <div className={s.footerWechat}>微信联系：{contactConfig.wechatId}</div>
            </div>
          </div>
          <div className={s.footerLinks}>
            {anchors.map((a) => (
              <a key={a.href} href={a.href}>
                {a.label}
              </a>
            ))}
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

// 案例卡片：封面（或缺省光晕）+ 编号 + 标签 + 名称 + 简介 + 作者/入口。
// 封面解析规则与 ProjectCard 一致：cover 优先，其次第一张图片成果，都没有就显示光晕底 + 项目图标
function CaseCard({ project, index }: { project: Project; index: number }) {
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
      {cover && "kind" in cover && cover.kind === "illustration" && (
        <span className={s.caseKind}>功能示意</span>
      )}
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
          <span>{provider ? provider.name : "提供者资料整理中"}</span>
          <Link href={href} className={s.caseGo}>
            {project.caseContent?.outputs?.length ? "查看成果" : "了解作品"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
