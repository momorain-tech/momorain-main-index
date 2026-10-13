import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getHomeProjects } from "@/lib/projects"
import { IntakeForm } from "@/components/participation/intake-form"

export const metadata: Metadata = { title: "我有 AI 需求", description: "整理业务问题与期望结果，通过微信与 AI有活沟通方案及合作方向。" }
export const revalidate = 300
export default async function RequestPage() {
  const { all } = await getHomeProjects()
  return <div className="wrap participation-page"><Link className="detail-back" href="/#services">← 返回服务内容</Link><header><span className="kicker">For clients</span><h1>你的需求，从聊清楚开始。</h1><p>说明业务问题和期望成果，由平台人工协助梳理与对接。</p></header><Suspense fallback={<p>正在准备需求整理工具，也可以通过首页微信直接联系。</p>}><IntakeForm kind="demand" projects={all.map((p) => ({ slug: p.slug, name: p.name }))} /></Suspense></div>
}
