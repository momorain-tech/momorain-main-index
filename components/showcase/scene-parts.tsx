import Link from "next/link"

import type { Project } from "@/lib/projects"
import { resultOutputs } from "@/lib/project-content"
import { IMPLEMENTATION_LABELS, type Scene } from "@/config/showcase"

// 第四版「场景演示」的共用部件：首页（app/(home)/page.tsx，暗色霓虹样式）和作品详情页都用。
// 首页的展示区样式在 v4.module.css 里，所以这里只放**和样式无关的判断**，外加详情页的 SceneFacts。
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
