import Link from "next/link"

import { contactConfig } from "@/config/contact"
import { platformNavigation } from "@/config/platform"
import { siteConfig } from "@/config/site"
import { BrandMark } from "@/components/jike/brand-mark"

// 页脚是服务端组件（没有 "use client"）：不需要交互，内容在构建时就渲染进 HTML。
//
// 二维码大图只放在首页联系区和弹窗里，页脚不再重复一整块面板；
// 但**微信号要以纯文本留在这里**：详情页、团队页、资料整理页的联系按钮都要 JS 才能弹窗，
// 微信内置浏览器里 JS 加载慢或失败时，页脚这一行就是访客唯一能看到的联系方式。
export function JikeFooter() {
  return (
    <footer className="platform-footer">
      <div className="wrap">
        <div className="platform-footer-row">
          <div>
            <Link className="logo" href="/">
              <BrandMark />
              {siteConfig.name}
            </Link>
            <p>让 AI 能力，落到真实业务。</p>
            <p className="footer-wechat">
              微信联系：<span className="consult-id-value">{contactConfig.wechatId}</span>
            </p>
          </div>
          {/* 和导航栏共用一份链接（config/platform.ts），改名时两边不会对不上 */}
          <div className="footer-links">
            {platformNavigation.map((l) => (
              <Link href={l.href} key={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="copyright">
          <span>
            © 2026 {siteConfig.name} · {siteConfig.brand}
          </span>
          <a href={siteConfig.links.github} target="_blank" rel="noreferrer">
            GitHub · momorain-tech ↗
          </a>
        </div>
      </div>
    </footer>
  )
}
