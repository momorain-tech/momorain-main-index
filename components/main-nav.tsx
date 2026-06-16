import Link from "next/link"

import { type SessionUser } from "@/lib/auth"
import { siteConfig } from "@/config/site"
import { Icons } from "@/components/icons"
import { ModeToggle } from "@/components/mode-toggle"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// user 由 layout.tsx 服务端读取后传入，这里只负责展示
export function MainNav({ user }: { user: SessionUser | null }) {
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

        {user ? (
          // 已登录：显示昵称 + 退出按钮
          // form POST 不需要 JS，Server Component 里也能用
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{user.nickname}</span>
            <form method="POST" action="/api/auth/logout">
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                退出
              </button>
            </form>
          </div>
        ) : (
          // 未登录：登录按钮（用 <a> 而非 Link，确保触发完整页面跳转）
          <a
            href="/api/auth/mock/login?redirect=true"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            登录
          </a>
        )}
      </div>
    </div>
  )
}
