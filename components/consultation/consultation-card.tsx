"use client"

import { useId, useRef, useState } from "react"

import { contactConfig } from "@/config/contact"
import { copyText } from "@/lib/clipboard"

// 咨询卡片：二维码、微信号、来源作品、一段可选的联系内容、两个复制按钮。
// 同一个组件用在两类地方：
// - 直接铺在页面上（首页「联系方式」、详情页底部、资料整理的预览步骤），传 compact，
//   只留二维码和微信号——这里是服务端渲染出来的，JS 没加载也能看到微信号
// - 导航栏、作品按钮弹出的对话框里（ConsultationProvider），完整版，多一个「整理联系内容」
//
// 联系内容只放在这个组件的 state 里：不发服务器、不存本地。
// 复制成功只说「已复制」，不说「已发送」——我们并不知道对方有没有真的发出去。

// 咨询的上下文。只从「已发布的项目数据」和代码里的场景配置生成（服务端组件传进来），
// 不读 URL 参数——否则别人可以拼一个链接，让面板里显示任意名字和网址
export type ConsultContext = {
  source: string // 从哪个入口打开的（nav / scene / detail / contact…），目前只用于区分
  // 意图决定标题和提示语：需求方 demand / 服务方 provider / 不区分 general
  intent?: "general" | "demand" | "provider"
  // 第四版：consult = 弹窗里先放轻量咨询表单（微信折叠在下面）；不写 = 只有微信联系卡
  mode?: "consult"
  // 预先选好的场景（CONSULT_SCENES 里的一项），微信联系话术里也会带上
  scene?: string
  project?: { slug: string; name: string; url: string }
}

// 对话框标题。放在这里而不是 provider 里，是为了和卡片的文案在同一个文件里对照着改
export function consultationTitle(context: ConsultContext | null): string {
  if (context?.mode === "consult")
    return context.project ? `我也有和「${context.project.name}」类似的情况` : "聊聊你的场景"
  if (context?.project) return `咨询与「${context.project.name}」相关的需求`
  if (context?.intent === "provider") return "交流 AI 服务合作"
  if (context?.intent === "demand") return "沟通 AI 项目需求"
  return "联系团队"
}

type CopyState = { target: "id" | "message"; ok: boolean } | null

export function ConsultationCard({
  context,
  headingId,
  compact = false,
}: {
  context: ConsultContext
  headingId?: string
  compact?: boolean
}) {
  const [need, setNeed] = useState("")
  const [copy, setCopy] = useState<CopyState>(null)
  const [qrFailed, setQrFailed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const needId = useId()

  const isProvider = context.intent === "provider"
  // 带场景的联系话术（第四版 §7）：加了微信不知道说什么的人，复制这段发过去就行
  const message = [
    isProvider
      ? "你好，我想交流 AI 服务合作与作品展示。"
      : context.scene && context.scene !== "还不确定" && context.scene !== "其他"
        ? `你好，我想聊聊「${context.scene}」这个场景。`
        : "你好，我想沟通 AI 项目需求。",
    context.project ? `参考作品：${context.project.name}（${context.project.url}）` : "",
    need.trim() ? `补充说明：${need.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  async function doCopy(target: "id" | "message", text: string) {
    // 把卡片自己的根节点传进去：降级复制要把临时 textarea 挂在对话框里面，原因见 lib/clipboard.ts
    const ok = await copyText(text, rootRef.current)
    setCopy({ target, ok })
  }

  return (
    <div ref={rootRef} className={`consult-card${compact ? " consult-card-compact" : ""}`}>
      <p className="consult-name" id={headingId}>
        {/* 没确认联系人时不编造人名 */}
        {contactConfig.contactName || "AI有活 · 核心团队"}
      </p>

      <div className="consult-contact">
        {qrFailed ? (
          <div className="consult-qr consult-qr-fallback" role="note">
            二维码暂未加载，请复制微信号添加
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 二维码要保留原始图片，手机上才能长按识别
          <img
            src={contactConfig.wechatQr}
            alt={`微信二维码，微信号 ${contactConfig.wechatId}`}
            className="consult-qr"
            width={176}
            height={176}
            onError={() => setQrFailed(true)}
          />
        )}
        <div className="consult-contact-text">
          {/* 微信号是纯文本、服务端就渲染好：复制按钮失效时用户还能手动选中 */}
          <p className="consult-id">
            微信号：<span className="consult-id-value">{contactConfig.wechatId}</span>
          </p>
          <button
            type="button"
            className="consult-btn consult-btn-primary"
            onClick={() => doCopy("id", contactConfig.wechatId)}
          >
            复制微信号
          </button>
          {/* 微信内置浏览器里没法自动跳转加好友，只能告诉用户怎么操作 */}
          <p className="consult-hint">电脑端扫码；手机端可长按识别，或复制微信号添加。</p>
        </div>
      </div>

      {context.project && (
        <p className="consult-source">
          来源作品：<b>{context.project.name}</b>
        </p>
      )}

      {/* 按意图提示「加了微信之后发什么」；不区分意图时不多说 */}
      {context.intent && context.intent !== "general" && (
        <p className="consult-note">
          {isProvider
            ? "添加微信后发送作品与服务资料，团队会和你交流合作。"
            : "添加微信后说说你的情况，团队会和你一起评估。"}
        </p>
      )}

      {/* 整理联系内容是可选的，默认折叠：大多数人只需要微信号 */}
      {!compact && (
        <details className="consult-compose">
          <summary>整理一段联系内容（可选）</summary>
          <label className="consult-label" htmlFor={needId}>
            {isProvider ? "你的作品与服务方向" : "想沟通的内容"}
          </label>
          <textarea
            id={needId}
            className="consult-input"
            rows={3}
            maxLength={2000}
            value={need}
            onChange={(e) => setNeed(e.target.value)}
            placeholder={isProvider ? "作品链接、你承担的工作、可以承接的方向" : "比如：想把培训视频整理为图文教程"}
          />
          <div className="consult-actions">
            <button type="button" className="consult-btn" onClick={() => doCopy("message", message)}>
              复制联系内容
            </button>
          </div>
          <p className="consult-note">复制后请自行粘贴到微信发送，团队不会自动收到这些内容。</p>
        </details>
      )}

      {/* aria-live：读屏用户也能听到复制结果 */}
      <p className="consult-status" role="status" aria-live="polite">
        {copy?.ok && (copy.target === "id" ? "微信号已复制" : "联系内容已复制，请粘贴到微信发送")}
        {copy && !copy.ok && "无法自动复制，请选中下方文字手动复制。"}
      </p>

      {/* 复制失败时把文字直接摆出来，保证一定有办法拿到 */}
      {copy && !copy.ok && (
        <pre className="consult-manual">{copy.target === "id" ? contactConfig.wechatId : message}</pre>
      )}

      {/* 补充说明（如「添加时备注来意」）统一在 config/contact.ts 里改 */}
      {contactConfig.note && <p className="consult-note">{contactConfig.note}</p>}
    </div>
  )
}
