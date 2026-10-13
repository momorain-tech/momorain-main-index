"use client"

import { useId, useRef, useState } from "react"
import { contactConfig } from "@/config/contact"
import { copyText } from "@/lib/clipboard"

// 上下文由可信页面数据生成。资料只在本地整理，复制不等于提交。
export type ConsultContext = {
  source: string
  intent?: "general" | "demand" | "provider"
  project?: { slug: string; name: string; url: string }
  provider?: { name: string; url: string }
  preparedMessage?: string
}
export function consultationTitle(context: ConsultContext | null): string {
  if (context?.project) return `咨询与「${context.project.name}」相关的需求`
  if (context?.intent === "provider") return "交流 AI 服务合作"
  if (context?.intent === "demand") return "沟通 AI 项目需求"
  return "联系 AI有活"
}

export function ConsultationCard({ context, headingId, compact = false }: {
  context: ConsultContext; headingId?: string; compact?: boolean
}) {
  const [need, setNeed] = useState("")
  const [copy, setCopy] = useState<{ target: "id" | "message"; ok: boolean } | null>(null)
  const [qrFailed, setQrFailed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const needId = useId()
  const isProvider = context.intent === "provider"
  const message = context.preparedMessage ?? [
    isProvider ? "你好，我想交流 AI 服务合作与作品展示。" : "你好，我想沟通 AI 项目需求。",
    context.project ? `参考作品：${context.project.name}（${context.project.url}）` : "",
    context.provider ? `相关服务方：${context.provider.name}（${context.provider.url}）` : "",
    need.trim() ? `补充说明：${need.trim()}` : "",
  ].filter(Boolean).join("\n")
  async function doCopy(target: "id" | "message", text: string) {
    setCopy({ target, ok: await copyText(text, rootRef.current) })
  }
  return <div ref={rootRef} className={`consult-card${compact ? " consult-card-compact" : ""}`}>
    <p className="consult-name" id={headingId}>{contactConfig.contactName || "AI有活 · 平台商务"}</p>
    <div className="consult-contact">
      {qrFailed ? <div className="consult-qr consult-qr-fallback" role="note">二维码暂未加载，请复制微信号添加</div> :
        /* eslint-disable-next-line @next/next/no-img-element -- 二维码保留原始图片，支持长按识别 */
        <img src={contactConfig.wechatQr} alt={`微信二维码，微信号 ${contactConfig.wechatId}`} className="consult-qr" width={176} height={176} onError={() => setQrFailed(true)} />}
      <div className="consult-contact-text"><p className="consult-id">微信号：<span className="consult-id-value">{contactConfig.wechatId}</span></p>
        <button type="button" className="consult-btn consult-btn-primary" onClick={() => doCopy("id", contactConfig.wechatId)}>复制微信号</button>
        <p className="consult-hint">电脑端扫码；手机端可长按识别，或复制微信号添加。</p>
      </div>
    </div>
    {context.project && <p className="consult-source">来源作品：<b>{context.project.name}</b>{context.provider && ` · ${context.provider.name}`}</p>}
    {context.intent && context.intent !== "general" && <p className="consult-note">{isProvider ? "添加微信后发送作品与服务资料，平台协助交流合作。" : "添加微信后发送需求，平台协助梳理与对接。"}</p>}
    {!compact && <details className="consult-compose"><summary>{context.preparedMessage ? "查看与复制已整理资料" : "整理一段联系内容（可选）"}</summary>
      {context.preparedMessage ? <pre className="consult-manual">{message}</pre> : <>
        <label className="consult-label" htmlFor={needId}>{isProvider ? "你的作品与服务方向" : "想沟通的内容"}</label>
        <textarea id={needId} className="consult-input" rows={3} maxLength={2000} value={need} onChange={(e) => setNeed(e.target.value)} placeholder={isProvider ? "作品链接、你承担的工作、可以承接的方向" : "比如：想把培训视频整理为图文教程"} />
      </>}
      <div className="consult-actions"><button type="button" className="consult-btn" onClick={() => doCopy("message", message)}>复制联系内容</button></div>
      <p className="consult-note">复制后请自行粘贴到微信发送，平台不会自动收到这些内容。</p>
    </details>}
    <p className="consult-status" role="status" aria-live="polite">{copy?.ok && (copy.target === "id" ? "微信号已复制" : "联系内容已复制，请粘贴到微信发送")}{copy && !copy.ok && "无法自动复制，请选中下方文字手动复制。"}</p>
    {copy && !copy.ok && <pre className="consult-manual">{copy.target === "id" ? contactConfig.wechatId : message}</pre>}
  </div>
}
