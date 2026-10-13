"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { siteConfig } from "@/config/site"
import { platformNavigation } from "@/config/platform"

import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/user-nav"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"

// 第二版保留四项主导航，其他说明收进首页的折叠区。
// 复用原账号和明暗切换；小屏菜单支持 Escape，跨页链接统一回到首页锚点。
// 旧锚点兼容由 HashScroll 负责，只在首页执行映射。
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
          <span className="logo-mark" aria-hidden="true">↗</span>{siteConfig.name}
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
