import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { IntakeForm } from "@/components/participation/intake-form"

export const metadata: Metadata = {
  title: "我能提供 AI 服务",
  description: "提交服务资料和代表作品，由 AI有活审核后对接需求与展示机会。",
}
export default function ProviderJoinPage() {
  return (
    <div className="wrap participation-page">
      <Link className="detail-back" href="/#services">
        ← 返回服务内容
      </Link>
      <header>
        <h1>提交服务资料</h1>
        <p>
          面向提供 AI 服务的个人和团队：业务咨询、能力培训、定制化 Agent、各类 AI
          工具都可以。三步提交，至少一个真实作品，提供方式任选一种。
        </p>
        <a className="inline-link" href="#requirements">
          资料要求与审核说明 ↓
        </a>
      </header>
      <details id="requirements" className="platform-details">
        <summary>资料要求与审核说明</summary>
        <div className="platform-details-body">
          <p>
            至少一个真实作品：给一个在线链接、上传截图或录屏、或提交构建好的静态网页包，三选一即可。基于开源项目改造的，请写明原项目和你改造的部分。
          </p>
          <p>
            提交后进入平台审核。审核只核对资料是否完整、可公开，不代表认证或订单承诺；公开展示前会和你确认内容。静态网页包审核通过后部署到独立的展示域名，部署完成前不会有可访问地址。
          </p>
        </div>
      </details>
      <Suspense fallback={<p>正在准备资料表单，也可以直接通过微信发送作品。</p>}>
        <IntakeForm kind="provider" />
      </Suspense>
    </div>
  )
}
