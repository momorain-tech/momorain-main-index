import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import type { Project } from "@/lib/projects"
import {
  OUTPUT_KIND_LABELS,
  inputOutputs,
  resultOutputs,
  type CaseOutput,
} from "@/lib/project-content"
import { projectConsultContext } from "@/lib/project-url"
import { IMPLEMENTATION_LABELS, ORIGIN_LABELS, type Scene } from "@/config/showcase"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"

// 第四版首页「场景演示」的几个部件。都是服务端组件（没有 "use client"），
// 内容在构建时就印进 HTML；只有「我也有类似情况」按钮是客户端的（ConsultationTrigger）。
//
// 一条贯穿的规矩（第四版 §3、§4）：成果区只放**真实产物**——后台案例内容里录入的 outputs。
// 没录入就显示「样例整理中」和文字说明，不拿功能示意图、宣传封面凑数，
// 也不把不同样例拼成一组「效果对比」。

// 场景的主作品：配置里排第一个、而且已经发布的那个。都没发布 = 这个场景不展示
// （不能把访客带到一个 404 的详情页）
export function primaryProject(scene: Scene, bySlug: Map<string, Project>): Project | undefined {
  for (const slug of scene.projectSlugs) {
    const p = bySlug.get(slug)
    if (p) return p
  }
}

// 「证据齐全」= 至少有一项真实成果。首屏只挑证据齐全的场景放图（§3「换用证据最齐全的演示」）
export function hasEvidence(p: Project | undefined): boolean {
  return !!p && resultOutputs(p.caseContent).length > 0
}

// 展示方式（§4 的第二个维度）：从真实数据推出来，不靠手填，避免标签和实际对不上
export function displayModes(p: Project): string[] {
  const results = resultOutputs(p.caseContent)
  const modes: string[] = []
  if (p.maturity === "interactive" && p.demo) modes.push("在线体验")
  if (results.some((o) => o.kind === "recording")) modes.push("真实录屏")
  if (results.some((o) => o.kind !== "recording")) modes.push("样例成果")
  return modes
}

// 一个成果或素材。图片默认只露出上半截清晰的局部（长教程缩成一整张会小到看不清），
// 点开看全图；视频不自动播放、preload="none"，点了才开始下载
export function MediaView({ item, crop = false }: { item: CaseOutput; crop?: boolean }) {
  if (item.type === "image") {
    return (
      <a
        className={`media-view media-image${crop ? " media-crop" : ""}`}
        href={item.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`查看全图：${item.caption}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 成果图可能是站外 https 地址 */}
        <img src={item.url} alt={item.caption} loading="lazy" />
        <span className="media-enlarge">查看全图 ↗</span>
      </a>
    )
  }
  if (item.type === "video") {
    return (
      <div className="media-view media-video">
        <video src={item.url} poster={item.poster} controls preload="none" playsInline>
          你的浏览器不能播放这个视频。
        </video>
        <a className="media-enlarge" href={item.url} target="_blank" rel="noreferrer">
          无法播放？直接打开视频 ↗
        </a>
      </div>
    )
  }
  return (
    <a className="media-view media-file" href={item.url} target="_blank" rel="noreferrer">
      查看文件 ↗
    </a>
  )
}

function KindTag({ item }: { item: CaseOutput }) {
  return <span className={`output-kind kind-${item.kind}`}>{OUTPUT_KIND_LABELS[item.kind]}</span>
}

// 成果旁边的说明（§3）：演示来源 · 本样例的处理范围 · 人工修改了哪些
function EvidenceNote({ scene, project }: { scene: Scene; project: Project }) {
  const c = project.caseContent
  return (
    <p className="evidence-note">
      <b>{ORIGIN_LABELS[scene.origin.kind]}</b>
      {c?.input && <> · 本样例的处理范围：{c.input}</>}
      {" · "}人工修改：{c?.manualEdits || "未注明"}
    </p>
  )
}

// ─── 首屏右侧 ──────────────────────────────────────────────────────
// 有真实成果：同一份样例的「输入 | 实际输出」并排；没有：文字版的输入 → 输出对照，明说样例还在整理
export function HeroEvidence({ scene, project }: { scene: Scene; project: Project }) {
  const results = resultOutputs(project.caseContent)
  const inputs = inputOutputs(project.caseContent)
  const sampleHref = `/projects/${project.slug}#outputs`
  if (!results.length) {
    return (
      <div className="hero-evidence hero-evidence-text">
        <p className="hero-evidence-kicker">{scene.title}</p>
        <div className="io-grid">
          <div className="io-col">
            <h3>你提供</h3>
            <ul>
              {scene.input.prepare.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <ArrowRight className="io-arrow" size={22} aria-hidden />
          <div className="io-col">
            <h3>你会得到</h3>
            <p>{scene.output}</p>
          </div>
        </div>
        <p className="evidence-note">
          <b>{ORIGIN_LABELS[scene.origin.kind]}</b> · 真实样例整理中：这里只放同一份输入对应的真实产物，不用示意图代替。
        </p>
        <Link className="inline-link" href={`/projects/${project.slug}`}>
          先了解「{project.name}」 →
        </Link>
      </div>
    )
  }
  return (
    <figure className="hero-evidence">
      <div className="io-grid io-grid-media">
        <div className="io-col">
          <h3>输入</h3>
          {inputs[0] ? (
            <>
              <MediaView item={inputs[0]} crop />
              <p className="io-caption">{inputs[0].caption}</p>
            </>
          ) : (
            <p className="io-caption">{project.caseContent?.input ?? scene.input.prepare[0]}</p>
          )}
        </div>
        <div className="io-col io-col-output">
          <h3>实际输出</h3>
          <MediaView item={results[0]} crop />
          <p className="io-caption">
            <KindTag item={results[0]} />
            {results[0].caption}
          </p>
        </div>
      </div>
      <figcaption>
        <EvidenceNote scene={scene} project={project} />
        <Link className="inline-link" href={sampleHref}>
          查看完整样例 →
        </Link>
      </figcaption>
    </figure>
  )
}

// ─── 重点演示：一个场景一个大展示区 ───────────────────────────────────
// 默认露出：成果、输入要求、会得到什么、关键限制；过程和其余边界折叠起来（§4「避免首页过长」）
export function SceneBlock({
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
    <section id={`scene-${scene.id}`} className="scene-block" aria-labelledby={`scene-${scene.id}-title`}>
      <header className="scene-head">
        <span className="scene-index">场景 {index + 1}</span>
        <h3 id={`scene-${scene.id}-title`}>{scene.title}</h3>
        <div className="scene-badges">
          <span className="badge">{IMPLEMENTATION_LABELS[scene.implementation]}</span>
          {modes.length ? (
            modes.map((m) => (
              <span key={m} className="badge badge-mode">
                {m}
              </span>
            ))
          ) : (
            <span className="badge badge-pending">样例整理中</span>
          )}
          <span className="badge badge-origin">{ORIGIN_LABELS[scene.origin.kind]}</span>
        </div>
      </header>

      <div className="scene-grid">
        <div className="scene-evidence">
          {results.length ? (
            <>
              <MediaView item={results[0]} crop />
              <p className="io-caption">
                <KindTag item={results[0]} />
                {results[0].caption}
                <span className="output-source">来源：{results[0].source}</span>
              </p>
              <EvidenceNote scene={scene} project={project} />
            </>
          ) : (
            <div className="scene-evidence-empty">
              <p className="scene-evidence-label">会得到</p>
              <p>{scene.output}</p>
              <p className="field-hint">真实样例整理中。这里只放真实产物，素材到位前不用示意图代替。</p>
            </div>
          )}
        </div>

        <div className="scene-facts">
          <div className="fact">
            <h4>任务</h4>
            <p>
              适合{scene.task.audience}。原来：{scene.task.before}
            </p>
          </div>
          <div className="fact">
            <h4>你需要准备</h4>
            <ul>
              {scene.input.prepare.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="fact">
            <h4>关键限制</h4>
            <p>{scene.boundary.assess[0]}</p>
          </div>
          <details className="fact-more">
            <summary>处理过程与适用范围</summary>
            <div className="fact">
              <h4>自动完成</h4>
              <ul>
                {scene.process.automated.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="fact">
              <h4>人工处理</h4>
              <ul>
                {scene.process.manual.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="fact">
              <h4>已经验证</h4>
              <ul>
                {scene.boundary.verified.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="fact">
              <h4>仍需评估</h4>
              <ul>
                {scene.boundary.assess.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <p className="field-hint">{scene.origin.note}</p>
          </details>
          <div className="scene-actions">
            <Link className="btn-ghost btn-md" href={`/projects/${project.slug}${results.length ? "#outputs" : ""}`}>
              {results.length ? "查看完整样例" : `了解「${project.name}」`}
              <ArrowUpRight size={16} />
            </Link>
            <ConsultationTrigger className="btn-primary btn-md" context={consult}>
              我也有类似情况
            </ConsultationTrigger>
          </div>
          {related.length > 0 && (
            <p className="scene-related">
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
    </section>
  )
}

// ─── 作品详情页里的场景说明 ────────────────────────────────────────────
// 和首页同一份 config/showcase.ts（§9「详情承接：与首页共用同一份内容」），全部摊开不折叠
export function SceneFacts({ scene }: { scene: Scene }) {
  return (
    <div className="scene-facts scene-facts-detail">
      <p className="detail-muted">
        这个作品对应首页的场景「<Link href={`/#scene-${scene.id}`}>{scene.title}</Link>」。
        {IMPLEMENTATION_LABELS[scene.implementation]} · {scene.origin.note}
      </p>
      <div className="fact">
        <h4>适合谁</h4>
        <p>{scene.task.audience}。原来：{scene.task.before}</p>
      </div>
      <div className="fact">
        <h4>你需要准备</h4>
        <ul>
          {scene.input.prepare.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="fact">
        <h4>你会得到</h4>
        <p>{scene.output}</p>
      </div>
      <div className="fact-pair">
        <div className="fact">
          <h4>自动完成</h4>
          <ul>
            {scene.process.automated.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="fact">
          <h4>人工处理</h4>
          <ul>
            {scene.process.manual.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="fact">
          <h4>已经验证</h4>
          <ul>
            {scene.boundary.verified.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="fact">
          <h4>仍需评估</h4>
          <ul>
            {scene.boundary.assess.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
