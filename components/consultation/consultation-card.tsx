"use client"

import { useId, useRef, useState } from "react"

import { contactConfig } from "@/config/contact"

// 咨询卡片：联系人、微信号、二维码、来源项目、一句话需求、两个复制按钮。
// 同一个组件用在两处——首页 / 详情页的「联系合作」区块（直接铺在页面上），
// 和导航栏、卡片上「咨询定制」弹出的对话框里（ConsultationProvider）。
//
// 需求短句只放在这个组件的 state 里：不发服务器、不存本地（§7.1，P0 不收集）。
// 复制成功只说「已复制」，不说「已发送」「已联系」——我们并不知道对方有没有真的发出去。

// 咨询的上下文。只从「已发布的项目数据」生成（服务端组件传进来），
// 不读 URL 参数——否则别人可以拼一个链接，让面板里显示任意名字和网址
export type ConsultContext = {
  source: string // 从哪个入口打开的（nav / hero / card / detail / contact…），目前只用于区分
  project?: { slug: string; name: string; url: string }
}

type CopyState = { target: "id" | "message"; ok: boolean } | null

export function ConsultationCard({
  context,
  headingId,
}: {
  context: ConsultContext
  headingId?: string
}) {
  const [need, setNeed] = useState("")
  const [copy, setCopy] = useState<CopyState>(null)
  const [qrFailed, setQrFailed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const needId = useId()

  const { project } = context
  const message = [
    "你好，我想咨询定制开发。",
    project ? `参考项目：${project.name}（${project.url}）` : "",
    need.trim() ? `我的需求：${need.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  async function doCopy(target: "id" | "message", text: string) {
    const ok = await copyText(text, rootRef.current)
    setCopy({ target, ok })
  }

  return (
    <div ref={rootRef} className="consult-card">
      <div className="consult-contact">
        {qrFailed ? (
          <div className="consult-qr consult-qr-fallback" role="note">
            二维码没加载出来，请复制下面的微信号添加
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 静态二维码，不需要 next/image 的尺寸优化
          <img
            src={contactConfig.wechatQr}
            alt={`微信二维码，微信号 ${contactConfig.wechatId}`}
            className="consult-qr"
            width={160}
            height={160}
            onError={() => setQrFailed(true)}
          />
        )}
        <div className="consult-contact-text">
          <p className="consult-name" id={headingId}>
            {contactConfig.contactName || "商务合作"} · 微信咨询
          </p>
          <p className="consult-id">
            微信号：<span className="consult-id-value">{contactConfig.wechatId}</span>
          </p>
          <button
            type="button"
            className="consult-btn"
            onClick={() => doCopy("id", contactConfig.wechatId)}
          >
            复制微信号
          </button>
          {/* 微信内置浏览器里没法自动跳转加好友，只能告诉用户怎么操作 */}
          <p className="consult-hint">手机上可以长按二维码识别，或复制微信号后在微信里搜索添加。</p>
        </div>
      </div>

      {project && (
        <p className="consult-source">
          来源项目：<b>{project.name}</b>
        </p>
      )}

      <label className="consult-label" htmlFor={needId}>
        一句话说说你的需求（可选，只用来生成下面要复制的内容）
      </label>
      <textarea
        id={needId}
        className="consult-input"
        rows={3}
        value={need}
        onChange={(e) => setNeed(e.target.value)}
        placeholder="比如：想把公司的培训视频批量做成图文教程"
      />

      <div className="consult-actions">
        <button
          type="button"
          className="consult-btn consult-btn-primary"
          onClick={() => doCopy("message", message)}
        >
          复制咨询内容
        </button>
      </div>

      {/* aria-live：读屏用户也能听到复制结果 */}
      <p className="consult-status" role="status" aria-live="polite">
        {copy?.ok && "已复制，可粘贴到微信。"}
        {copy && !copy.ok && "这个浏览器不允许自动复制，请长按选中下面的文字手动复制。"}
      </p>

      {/* 复制失败时把文字直接摆出来，保证一定有办法拿到 */}
      {copy && !copy.ok && (
        <pre className="consult-manual">
          {copy.target === "id" ? contactConfig.wechatId : message}
        </pre>
      )}

      {contactConfig.note && <p className="consult-note">{contactConfig.note}</p>}
    </div>
  )
}

// 复制到剪贴板，两级降级：
// 1. navigator.clipboard：现代浏览器，但要求 HTTPS + 页面有焦点，部分内置浏览器直接禁用
// 2. 隐藏 textarea + execCommand("copy")：老办法，已被标记废弃但兼容性最好
// 都不行就返回 false，由调用方把文字摆出来让用户手动复制。
//
// 为什么 textarea 要挂在 container 里而不是 document.body：
// 原生 <dialog> 打开时处在浏览器的「顶层」，挂在 body 上的元素在它下面，选不中
async function copyText(text: string, container: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续走降级方案
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    ;(container ?? document.body).appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}
