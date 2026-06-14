import Link from "next/link"

import { siteConfig } from "@/config/site"
import { Icons } from "@/components/icons"
import { ModeToggle } from "@/components/mode-toggle"

// 纯展示组件，无交互，所以不需要 "use client"
// Link 是 Next.js 的客户端路由组件，比 <a> 标签更快（预加载）

export function MainNav() {
  return (
    <div className="flex w-full items-center justify-between gap-6">
      {/* 左侧：Logo + 站点名 */}
      <Link href="/" className="flex items-center space-x-2">
        <Icons.logo />
        <span className="font-bold">{siteConfig.name}</span>
      </Link>

      {/* 中间：导航链接 */}
      <nav className="hidden gap-6 md:flex">
        <Link
          href="#about"
          className="flex items-center text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          关于我们
        </Link>
        <Link
          href={siteConfig.links.github}
          target="_blank"
          rel="noreferrer"
          className="flex items-center text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          GitHub
        </Link>
      </nav>

      {/* 右侧：主题切换 */}
      <ModeToggle />
    </div>
  )
}
