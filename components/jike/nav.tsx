"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { siteConfig } from "@/config/site"
import { BrandMark } from "@/components/jike/brand-mark"
import { platformNavigation } from "@/config/platform"

import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/user-nav"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"

// 设计稿导航，在原稿上补的几样东西：
// 1. 右侧登录/用户入口（UserNav）——按钮用 shadcn 令牌类，在 .jk-skin 容器里自动换成新调色板
// 2. 明暗切换按钮（设计稿只有深色，浅色为后补配色）
// 3. ≤768px 时导航链接收进汉堡菜单（设计稿是直接 display:none，窄窗口下导航会整个消失）
// 4. 右侧主操作「联系平台」打开全站共用的咨询对话框。保持 4 个字：
//    360px 宽时导航栏已经没有余量，再长就会把昵称挤没（见 CLAUDE.md 导航栏窄屏一节）
//
// 链接是第二版的四项主导航，和页脚共用 config/platform.ts 的同一份数据。
// 链接一律写成 /#xxx：从子页面点过来先回首页再滚到区块，在首页点则原地平滑滚动——
// 滚动和旧锚点兼容都由 (public)/layout 里的 HashScroll 统一处理
const NAV_LINKS = platformNavigation

export function JikeNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Escape 关菜单。只监听一次，handler 里读 state 用函数式更新
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <nav>
      <div className="wrap nav-inner">
        <Link className="logo" href="/">
          <BrandMark />{siteConfig.name}
        </Link>
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <ModeToggle />
          <UserNav />
          <ConsultationTrigger className="nav-cta" context={{ source: "nav" }}>
            联系平台
          </ConsultationTrigger>
          {/* 汉堡按钮只在 ≤768px（导航链接被隐藏时）显示，见 jike.css */}
          <button
            type="button"
            className="nav-burger"
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="nav-menu">
          {/* 点空白处关菜单：铺满视口的透明层，菜单面板盖在它上面 */}
          <div
            className="nav-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="nav-menu-panel">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
