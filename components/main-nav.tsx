import Link from "next/link"

import { siteConfig } from "@/config/site"
import { Icons } from "@/components/icons"
import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/user-nav"

// 导航本体是纯展示的 Server Component
// 登录态由 UserNav（Client Component）自行请求 /api/me，不经过 layout
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

      {/* 右侧：主题切换 + 用户区域 */}
      <div className="flex items-center gap-3">
        <ModeToggle />
        <UserNav />
      </div>
    </div>
  )
}
