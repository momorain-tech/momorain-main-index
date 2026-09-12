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
      <Link href="/" className="flex shrink-0 items-center space-x-2">
        <Icons.logo />
        {/* 手机上只留图标：390px 宽时导航栏右侧有主题、管理、昵称、退出四样东西，
            Logo 文字再占 85px，昵称就被挤得一个字都不剩（它是进账号页的唯一入口）。
            sr-only 让读屏软件仍然能读出站点名 */}
        <span className="sr-only font-bold sm:not-sr-only">{siteConfig.name}</span>
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

      {/* 右侧：主题切换 + 用户区域。
          min-w-0 让这一组在窄屏上可以收缩（真正收缩的是 UserNav 里的昵称），
          Logo 则 shrink-0 保持完整 */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <ModeToggle />
        <UserNav />
      </div>
    </div>
  )
}
