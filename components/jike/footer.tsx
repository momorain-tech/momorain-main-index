"use client"

import Link from "next/link"
import { useState } from "react"

import { useToast } from "@/components/jike/toast"

// 设计稿页脚。邮箱订阅暂无后端，保留设计稿的 toast 占位行为
// （设计稿 README：上线后接真实订阅 + 统计）。
export function JikeFooter() {
  const notify = useToast()
  const [email, setEmail] = useState("")

  function subscribe() {
    notify(email.trim() ? "🎉 订阅成功！新神器上架，第一时间通知你" : "✏️ 先填个邮箱吧")
    setEmail("")
  }

  return (
    <footer id="subscribe">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="logo" href="/">
              <span className="logo-mark">⚡</span>即刻体验
            </Link>
            <p>
              神器超市，点开就能用。
              <br />
              不用下载，群里还有人带你玩。
            </p>
            <div className="subscribe">
              <input
                type="email"
                value={email}
                placeholder="你的邮箱，新神器上架第一时间通知"
                onChange={(e) => setEmail(e.target.value)}
              />
              <button onClick={subscribe}>订阅</button>
            </div>
          </div>
          <div className="footer-col">
            <h4>探索</h4>
            <Link href="/#shelf">神器货架</Link>
            <Link href="/#who">按身份挑</Link>
            <Link href="/#custom">专属定制</Link>
          </div>
          <div className="footer-col">
            <h4>合作</h4>
            <Link href="/#dev">神器上架</Link>
            <Link href="/#subscribe">商务合作</Link>
            {/* 联系我们：微信二维码 + 微信号（替换原来的锚点链接） */}
            <div className="footer-qr">
              <span className="qr-label">联系我们</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- 静态二维码图片，无需 next/image 优化 */}
              <img src="/wechat-qr.jpg" alt="微信二维码" className="qr-img" />
              <p className="qr-id">微信号：instusehub_com</p>
            </div>
          </div>
        </div>
        <div className="copyright">
          <span>© 2026 即刻体验 · 网上的神器，点开就能用</span>
          <span>为不会写代码的你准备</span>
        </div>
      </div>
    </footer>
  )
}
