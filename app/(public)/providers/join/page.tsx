import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { IntakeForm } from "@/components/participation/intake-form"

export const metadata: Metadata = {
  title: "我能提供 AI 服务",
  description: "整理真实作品、服务能力与承接条件，通过 AI有活交流作品展示和服务合作。",
}
export default function ProviderJoinPage() {
  return (
    <div className="wrap participation-page">
      <Link className="detail-back" href="/#services">
        ← 返回服务内容
      </Link>
      <header>
        <span className="kicker">For builders</span>
        <h1>
          让你的 AI 解决能力，
          <br />
          被有需求的人看见。
        </h1>
        <p>
          面向具备 AI
          应用开发、工具集成或业务解决能力的个人与小团队，通过真实作品和人工沟通寻找合适的合作机会。
        </p>
        <a className="inline-link" href="#requirements">
          查看资料整理要求 ↓
        </a>
      </header>
      <details id="requirements" className="platform-details">
        <summary>资料要求与合作说明</summary>
        <div className="platform-details-body">
          <p>
            至少一个可查看的真实作品，说明输入输出、本人承担的工作、第三方或开源基础，以及可公开范围。没有在线
            Demo，也可以提供录屏或成果链接。
          </p>
          <p>
            平台协助展示能力、对接需求、核对合作边界。资料需要人工核对，提交不代表通过审核，也不保证订单；具体合作、报价与排期由双方沟通确认。
          </p>
        </div>
      </details>
      <Suspense fallback={<p>正在准备资料整理工具，也可以直接通过微信发送作品。</p>}>
        <IntakeForm kind="provider" />
      </Suspense>
    </div>
  )
}
