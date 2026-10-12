import Link from "next/link"

import { contactConfig } from "@/config/contact"
import { siteConfig } from "@/config/site"

// 页脚。原来的邮箱订阅表单已删除：它没有后端，点「订阅」却提示「订阅成功」（§2.2）。
// 等真的有地方存、有人负责发之后再加回来。
//
// 现在是纯服务端组件（没有任何交互），不再需要 "use client"。
// 微信号和二维码从 config/contact.ts 读，和咨询面板是同一份。
export function JikeFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="logo" href="/">
              <span className="logo-mark">⚡</span>
              {siteConfig.name}
            </Link>
            <p>
              {siteConfig.brand} 帮助企业、内容团队和个人创业者，把具体需求落成可用、可部署、可展示、可管理的应用。
            </p>
          </div>
          <div className="footer-col">
            <h4>了解我们</h4>
            <Link href="/#services">服务内容</Link>
            <Link href="/#projects">项目案例</Link>
            <Link href="/#process">合作流程</Link>
            <Link href="/#about">关于我们</Link>
            <Link href="/#faq">常见问题</Link>
          </div>
          <div className="footer-col">
            <h4>联系合作</h4>
            <div className="footer-qr">
              {/* eslint-disable-next-line @next/next/no-img-element -- 静态二维码图片，无需 next/image 优化 */}
              <img
                src={contactConfig.wechatQr}
                alt={`微信二维码，微信号 ${contactConfig.wechatId}`}
                className="qr-img"
                loading="lazy"
              />
              <p className="qr-id">微信号：{contactConfig.wechatId}</p>
            </div>
          </div>
        </div>
        <div className="copyright">
          <span>
            © 2026 {siteConfig.name} · {siteConfig.brand}
          </span>
          <a href={siteConfig.links.github} target="_blank" rel="noreferrer">
            GitHub · momorain-tech
          </a>
        </div>
      </div>
    </footer>
  )
}
