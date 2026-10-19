import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getHomeProjects } from "@/lib/projects"
import { IntakeForm } from "@/components/participation/intake-form"

export const metadata: Metadata = {
  title: "提交 AI 需求",
  description: "说明业务问题与期望结果，两步提交给 AI有活，由平台专人按你留的联系方式跟进。",
}
// 和首页一样走 ISR：参考作品下拉框的项目列表来自数据库，后台改了项目会通过
// lib/revalidate-project.ts 立即刷新这一页，平时最多 5 分钟自动更新
export const revalidate = 300

// 页面布局：电脑上「左边表单 + 右边填写帮助」，手机上收成单列（帮助排在表单下面）。
// 帮助栏是纯静态内容，在服务端渲染好——不跟着步骤变，所以不需要放进客户端组件里
export default async function RequestPage() {
  const { all } = await getHomeProjects()
  return (
    <div className="wrap participation-page request-page">
      <Link className="detail-back" href="/#services">
        ← 返回服务内容
      </Link>
      <header>
        <h1>提交 AI 需求</h1>
        <p>不用先懂技术，说清现在的问题和希望得到的结果，两步就能提交。平台收到后由专人按你留的联系方式联系你。</p>
      </header>
      <div className="request-layout">
        <div className="request-main">
          {/* IntakeForm 用了 useSearchParams（读 ?project=xxx），必须包在 Suspense 里：
              这样页面外框照样构建期静态生成，只有表单部分等到浏览器里再渲染 */}
          <Suspense fallback={<p>正在准备需求表单，也可以通过首页微信直接联系。</p>}>
            <IntakeForm kind="demand" projects={all.map((p) => ({ slug: p.slug, name: p.name }))} />
          </Suspense>
        </div>
        <aside className="request-help" aria-label="填写帮助">
          <section>
            <h2>怎么写更容易被理解</h2>
            <p>像跟同事解释一样写就行，不需要技术词。一个好例子：</p>
            <dl className="request-example">
              <div>
                <dt>遇到的问题</dt>
                <dd>每周要把 20 多个培训视频整理成图文教程，两个人手工截图写说明，一个视频要半天。</dd>
              </div>
              <div>
                <dt>期望的结果</dt>
                <dd>上传视频后自动生成带截图的分步教程，能导出 Word，人工改改就能发给学员。</dd>
              </div>
            </dl>
            <p className="request-help-muted">预算、时间、行业这些拿不准可以先不填，平台联系你时再沟通。</p>
          </section>
          <section>
            <h2>提交之后</h2>
            <ol className="request-steps">
              <li>平台收到需求，生成需求编号，你可以随时查看进度</li>
              <li>专人阅读需求，通过你留的电话、微信或邮箱联系你</li>
              <li>沟通清楚后，给出可行的做法和下一步建议</li>
            </ol>
          </section>
          <section>
            <h2>登录与隐私</h2>
            <p>
              填写不需要登录；点「提交」时用手机号登录，方便之后查看进度，登录前填的内容不会丢。
              联系方式只用于平台和你对接，不公开展示，也不会发给 AI 模型。
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
