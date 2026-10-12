"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/user-nav"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"

// 设计稿导航，三个功能补丁：
// 1. 右侧加登录/用户入口——UserNav 的按钮用 shadcn 令牌类，
//    在 .jk-skin 容器里自动换成新调色板，登录/登出逻辑零改动
// 2. 保留明暗切换按钮（设计稿只有深色，浅色为后补配色）
// 3. ≤768px 时导航链接收进汉堡菜单（设计稿是直接 display:none，
//    等于移动端/窄窗口下导航整个消失——PC 窗口窄时页面看起来
//    就像"手机版坏了一半"，所以补上菜单面板）
//
// 4. 右侧主操作是「咨询定制」（打开全站共用的咨询对话框），替代原来的「开玩神器」——
//    两个都是 4 个字，360px 下宽度不变，不会把昵称挤没（见 CLAUDE.md 导航栏窄屏一节）
//
// 锚点链接一律指向 /#xxx，滚动由 (public)/layout 里的 HashScroll 统一处理：
// 从子页面点过来会先回到首页再滚到区块，在首页点则原地平滑滚动。

// §4.1：服务内容 / 项目案例 / 关于我们 / 联系合作。
// 旧锚点（#shelf、#custom…）的兼容在 HashScroll 里处理
const NAV_LINKS = [
  { href: "/#services", label: "服务内容" },
  { href: "/#projects", label: "项目案例" },
  { href: "/#about", label: "关于我们" },
  { href: "/#contact", label: "联系合作" },
]

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
          <span className="logo-mark">⚡</span>即刻体验
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
            咨询定制
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
