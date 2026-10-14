import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getHomeProjects } from "@/lib/projects"
import { IntakeForm } from "@/components/participation/intake-form"

export const metadata: Metadata = {
  title: "我有 AI 需求",
  description: "说明业务问题与期望结果，提交给 AI有活，由平台专人跟进并辅以 AI 初步分析。",
}
// 和首页一样走 ISR：参考作品下拉框的项目列表来自数据库，后台改了项目会通过
// lib/revalidate-project.ts 立即刷新这一页，平时最多 5 分钟自动更新
export const revalidate = 300

export default async function RequestPage() {
  const { all } = await getHomeProjects()
  return (
    <div className="wrap participation-page">
      <Link className="detail-back" href="/#services">
        ← 返回服务内容
      </Link>
      <header>
        <h1>提交 AI 需求</h1>
        <p>说清现在的问题和希望得到的结果，两步就能提交。平台收到后由专人跟进，并用 AI 做一次初步分析。</p>
      </header>
      {/* IntakeForm 用了 useSearchParams（读 ?project=xxx），必须包在 Suspense 里：
          这样页面外框照样构建期静态生成，只有表单部分等到浏览器里再渲染 */}
      <Suspense fallback={<p>正在准备需求表单，也可以通过首页微信直接联系。</p>}>
        <IntakeForm kind="demand" projects={all.map((p) => ({ slug: p.slug, name: p.name }))} />
      </Suspense>
    </div>
  )
}
