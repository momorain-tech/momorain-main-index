import Link from "next/link"
import { siteConfig } from "@/config/site"
import { platformNavigation } from "@/config/platform"

// 二维码放在主联系区和按需弹窗，页脚不再重复一整块咨询面板。
export function JikeFooter() {
  return <footer className="platform-footer"><div className="wrap">
    <div className="platform-footer-row"><div><Link className="logo" href="/"><span className="logo-mark" aria-hidden="true">↗</span>{siteConfig.name}</Link><p>让技术找到需求，让需求走向落地。</p></div>
      <div className="footer-links">{platformNavigation.map((l) => <Link href={l.href} key={l.href}>{l.label}</Link>)}</div>
    </div><div className="copyright"><span>© 2026 {siteConfig.name} · {siteConfig.brand}</span><a href={siteConfig.links.github} target="_blank" rel="noreferrer">GitHub · momorain-tech ↗</a></div>
  </div></footer>
}
