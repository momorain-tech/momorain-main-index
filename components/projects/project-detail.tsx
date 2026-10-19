import Link from "next/link"

import type { Project } from "@/lib/projects"
import { OUTPUT_KIND_LABELS, inputOutputs, resultOutputs, type CaseOutput } from "@/lib/project-content"
import { projectConsultContext } from "@/lib/project-url"
import { goals as GOAL_DEFS } from "@/config/home"
import { providerJoin } from "@/config/platform"
import { sceneOfProject } from "@/config/showcase"
import { SceneFacts } from "@/components/showcase/scene-parts"
import { DemoToggle } from "@/components/demo-toggle"
import { ConsultationCard } from "@/components/consultation/consultation-card"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import { ProjectLabels } from "@/components/projects/project-labels"

// 项目详情模板（§5.2 的 9 个部分；第四版加了「适用场景与边界」、去掉了服务方署名）。
// 公开详情页和后台预览共用这一个组件：
// - 公开页（preview=false）：缺的部分直接不显示。能公开的项目都过了发布检查，
//   缺的只会是迁移 004 之前的老项目，它们只显示原有的简介
// - 后台预览（preview=true）：缺的部分显示成「待补」占位，让运营一眼看到还差什么
//
// 所有内容都按纯文本渲染（React 默认会转义），案例内容里就算混进了 HTML 也不会执行
export function ProjectDetail({ project, preview = false }: { project: Project; preview?: boolean }) {
  const c = project.caseContent
  const scene = sceneOfProject(project.slug)
  const demandHref = `/requests/new?${new URLSearchParams({
    project: project.slug,
    ...(scene ? { scene: scene.consultScene } : {}),
  })}`
  // 「沟通类似需求」打开轻量咨询（场景按作品所属的首页场景预选）；页面底部仍直接铺着微信卡
  const consult = projectConsultContext(project, "detail")
  const results = resultOutputs(c)
  const inputs = inputOutputs(c)
  const canTry = project.maturity === "interactive" && project.demo
  const legacyTool = !project.maturity && project.demo

  return (
    <div className="wrap detail">
      <Link href={scene ? `/#scene-${scene.id}` : "/#more"} className="detail-back">
        ← 返回场景演示
      </Link>

      {/* 1. 用途概述 */}
      <header className="detail-head">
        <span className="proj-icon detail-icon" aria-hidden="true">
          {project.icon}
        </span>
        <div className="min-w-0">
          <h1>{project.name}</h1>
          <p className="detail-sub">{project.desc}</p>
          <ProjectLabels project={project} />
          <div className="detail-actions">
            {canTry && (
              <a className="btn-primary btn-md" href={project.demo} target="_blank" rel="noreferrer">
                在线体验 ↗
              </a>
            )}
            <ConsultationTrigger className={canTry ? "btn-ghost btn-md" : "btn-primary btn-md"} context={consult}>
              我也有类似情况
            </ConsultationTrigger>
            {legacyTool && (
              <a className="btn-ghost btn-md" href={project.demo} target="_blank" rel="noreferrer">
                打开工具页 ↗
              </a>
            )}
          </div>
          {canTry && <p className="detail-note">{c?.limits?.join("；") || "实时执行的登录、费用和配置要求，请先在工具页面核对。"}</p>}
          {legacyTool && (
            <p className="detail-note">
              登录、费用等使用条件，以工具页内的说明为准。
            </p>
          )}
        </div>
      </header>

      {/* 2. 真实成果：放在最前面，成果承担主要的说服力（§4.4）。
          第四版：原始素材（输入）和成果分开摆，生成结果 / 人工修订版各自带标记；
          首页「查看完整样例」跳的就是这里（#outputs） */}
      {results.length ? (
        <Section id="outputs" title="完整样例">
          {(c?.input || c?.manualEdits) && (
            <p className="detail-muted">
              {c?.input && <>本样例的处理范围：{c.input}。</>}
              人工修改：{c?.manualEdits || "未注明"}
            </p>
          )}
          {inputs.length > 0 && (
            <>
              <h3 className="detail-subhead">输入</h3>
              <div className="detail-outputs">
                {inputs.map((o, i) => (
                  <OutputItem key={i} output={o} />
                ))}
              </div>
              <h3 className="detail-subhead">输出</h3>
            </>
          )}
          <div className="detail-outputs">
            {results.map((o, i) => (
              <OutputItem key={i} output={o} />
            ))}
          </div>
        </Section>
      ) : (
        preview && <Pending title="完整样例（至少一项成果）" />
      )}

      {/* 和首页同一份场景说明（config/showcase.ts）：任务、准备什么、自动/人工、边界 */}
      {scene && (
        <Section id="scene" title="适用场景与边界">
          <SceneFacts scene={scene} />
        </Section>
      )}

      <Section id="overview" title="用途概述">
        <p>{project.longDesc}</p>
        {c?.audience && <Field label="适合谁">{c.audience}</Field>}
        {c?.role && <Field label="应用负责的环节">{c.role}</Field>}
      </Section>

      {/* 3. 业务场景与问题 */}
      {c?.scenario || c?.problem ? (
        <Section id="scenario" title="业务场景与问题">
          {c.scenario && <Field label="场景">{c.scenario}</Field>}
          {c.problem && <Field label="原来怎么做">{c.problem}</Field>}
        </Section>
      ) : (
        preview && <Pending title="业务场景与问题" />
      )}

      {/* 4. 输入和过程 */}
      {c?.input || c?.steps?.length || canTry ? (
        <Section id="process" title="输入和过程">
          {c?.input && <Field label="输入样例">{c.input}</Field>}
          {c?.steps?.length ? (
            <ol className="detail-steps">
              {c.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : null}
          {/* 内嵌预览按需打开，不预加载工具的资源；嵌入失败时旁边有「新标签打开」 */}
          {canTry && <DemoToggle url={project.demo!} />}
        </Section>
      ) : (
        preview && <Pending title="输入和过程" />
      )}

      {/* 5. 团队贡献 */}
      {c?.contribution ? (
        <Section id="contribution" title="团队贡献">
          {c.contribution.self && <Field label="我们做的部分">{c.contribution.self}</Field>}
          {c.contribution.openSource && <Field label="开源基础">{c.contribution.openSource}</Field>}
          {c.contribution.thirdParty && <Field label="第三方模型与服务">{c.contribution.thirdParty}</Field>}
        </Section>
      ) : (
        preview && <Pending title="团队贡献" />
      )}

      {/* 6. 四个目标在这个项目上的实际情况 */}
      {c?.goals && Object.keys(c.goals).length ? (
        <Section id="goals" title="可用 · 可部署 · 可展示 · 可管理">
          <p className="detail-muted">下面写的是这个项目目前的实际情况，不是统一承诺。</p>
          <div className="detail-goals">
            {GOAL_DEFS.map((g) => {
              const text = c.goals?.[g.key]
              if (!text && !preview) return null
              return (
                <div key={g.key} className="goal-card">
                  <h3>{g.title}</h3>
                  <p>{text ?? "待补"}</p>
                </div>
              )
            })}
          </div>
        </Section>
      ) : (
        preview && <Pending title="四个目标的项目说明" />
      )}

      {/* 7. 定制与交付 */}
      {c?.customization?.length || c?.deliverables?.length || c?.excluded?.length ? (
        <Section id="delivery" title="定制与交付">
          <List label="可以调整的地方" items={c.customization} />
          <List label="交付物" items={c.deliverables} />
          <List label="不包含" items={c.excluded} />
        </Section>
      ) : (
        preview && <Pending title="定制与交付" />
      )}

      {/* 8. 限制与费用 */}
      {c?.limits?.length || c?.dataFlow ? (
        <Section id="limits" title="限制、费用与数据">
          <List label="使用条件与限制" items={c.limits} />
          {c.dataFlow && <Field label="数据去向">{c.dataFlow}</Field>}
        </Section>
      ) : (
        preview && <Pending title="限制、费用与数据" />
      )}

      {project.tags.length > 0 && (
        <div className="detail-tags" aria-label="标签">
          {project.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 9. 合作入口：区分需求方（带着这个作品去整理需求）和服务方（我也想展示作品）。
          子应用的「咨询」按钮会跳到这里（/projects/xxx#contact），所以这里必须直接摆出微信号：
          弹窗要等 JS 加载，微信内置浏览器里 JS 慢或失败时，这张 compact 卡片（服务端渲染）是兜底 */}
      <Section id="contact" title="从这个作品，聊聊你的情况">
        <p className="detail-muted">
          由核心团队负责沟通和评估。还在了解可以先发起轻量咨询；已有明确项目可以直接填完整需求，作品和场景会一起带过去。
        </p>
        <div className="detail-actions">
          <ConsultationTrigger className="btn-primary btn-md" context={consult}>
            我也有类似情况
          </ConsultationTrigger>
          <Link href={demandHref} className="btn-ghost btn-md">
            填写完整需求 ↗
          </Link>
        </div>
        <ConsultationCard context={{ ...consult, mode: undefined }} compact />
        <p className="detail-back-bottom">
          <Link className="inline-link" href={providerJoin.href}>
            我提供 AI 服务，想合作 →
          </Link>
        </p>
        <p className="detail-back-bottom">
          <Link href="/#scenes">← 看看其他场景</Link>
        </p>
      </Section>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="detail-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  )
}

function Pending({ title }: { title: string }) {
  return (
    <section className="detail-section detail-pending">
      <h2>{title}</h2>
      <p>待补（只在后台预览里显示这个占位，公开页面会直接隐藏这一节）</p>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-field">
      <h3>{label}</h3>
      <p>{children}</p>
    </div>
  )
}

function List({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div className="detail-field">
      <h3>{label}</h3>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

// 单个成果。每个都带「示例成果 / 操作录像」标记和来源说明（§5.2、§6.1）。
// 视频不自动播放、preload="none"：首页和详情页不主动下载大文件
function OutputItem({ output }: { output: CaseOutput }) {
  return (
    <figure className="output-item">
      {output.type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element -- 成果图可能是站外 https 地址
        <a href={output.url} target="_blank" rel="noreferrer" aria-label={`放大查看：${output.caption}`}>
          <img src={output.url} alt={output.caption} loading="lazy" />
          <span className="output-enlarge">点击查看原图 ↗</span>
        </a>
      )}
      {output.type === "video" && (
        <video src={output.url} poster={output.poster} controls preload="none" playsInline>
          你的浏览器不能播放这个视频。
        </video>
      )}
      {output.type === "video" && <a className="output-enlarge" href={output.url} target="_blank" rel="noreferrer">无法播放？直接打开视频 ↗</a>}
      {output.type === "file" && (
        <a className="output-file" href={output.url} target="_blank" rel="noreferrer">
          📎 查看文件
        </a>
      )}
      <figcaption>
        <span className="output-kind">{OUTPUT_KIND_LABELS[output.kind]}</span>
        {output.caption}
        <span className="output-source">来源：{output.source}</span>
      </figcaption>
    </figure>
  )
}
