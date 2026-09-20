"use client"

import Link from "next/link"

import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/user-nav"

// 设计稿导航，两个功能补丁：
// 1. 右侧加登录/用户入口——UserNav 的按钮用 shadcn 令牌类，
//    在 .jk-skin 容器里自动换成新调色板，登录/登出逻辑零改动
// 2. 保留明暗切换按钮（设计稿只有深色，浅色为后补配色）
//
// 锚点链接一律指向 /#xxx，滚动由 (public)/layout 里的 HashScroll 统一处理：
// 从子页面点过来会先回到首页再滚到区块，在首页点则原地平滑滚动。
export function JikeNav() {
  return (
    <nav>
      <div className="wrap nav-inner">
        <Link className="logo" href="/">
          <span className="logo-mark">⚡</span>即刻体验
        </Link>
        <div className="nav-links">
          <Link href="/#pain">为什么用我们</Link>
          <Link href="/#who">你需要的</Link>
          <Link href="/#shelf">神器货架</Link>
          <Link href="/#custom">专属定制</Link>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <ModeToggle />
          <UserNav />
          <Link className="nav-cta" href="/#shelf">
            开玩神器
          </Link>
        </div>
      </div>
    </nav>
  )
}
