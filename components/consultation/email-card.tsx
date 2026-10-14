"use client"

import { useRef, useState } from "react"

import { copyText } from "@/lib/clipboard"

// 首页联系区的邮箱卡：地址是可以选中的纯文本（服务端渲染，JS 没加载也能看到），
// 外加「复制」和「写邮件」（mailto:）两个按钮。
//
// 文案上的分寸：点 mailto 只是打开了邮件应用，我们不知道对方有没有真的发出去，
// 所以不显示「邮件已发送」；复制也只说「已复制」
export function EmailCard({ email }: { email: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState<boolean | null>(null)
  return (
    <div ref={rootRef} className="consult-card consult-card-compact contact-email">
      <p className="consult-name">邮箱</p>
      <p className="consult-id">
        <span className="consult-id-value contact-email-value">{email}</span>
      </p>
      <div className="consult-actions">
        <button
          type="button"
          className="consult-btn consult-btn-primary"
          onClick={async () => setCopied(await copyText(email, rootRef.current))}
        >
          复制邮箱
        </button>
        <a className="consult-btn" href={`mailto:${email}`}>
          写邮件
        </a>
      </div>
      <p className="consult-status" role="status" aria-live="polite">
        {copied === true && "邮箱已复制"}
        {copied === false && "无法自动复制，请手动选中上面的地址"}
      </p>
      <p className="consult-hint">适合发送较长的需求说明或作品材料。</p>
    </div>
  )
}
