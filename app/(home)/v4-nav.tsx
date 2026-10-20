"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { siteConfig } from "@/config/site"
import { platformNavigation } from "@/config/platform"
import { UserNav } from "@/components/user-nav"
import { ConsultationTrigger } from "@/components/consultation/consultation-provider"
import s from "./v4.module.css"

// 首页导航。对照线上 JikeNav：登录/用户入口（UserNav）、≤760px 汉堡菜单、
// 咨询弹窗（ConsultationTrigger，与全站共用同一个对话框）。明暗切换不接——全站不做主题切换
// （2026-10-15 定稿：首页暗色霓虹，二级页面浅色清新）。
// 页内锚点：第四版三项导航 #scenes / #cooperation / #team（config/platform.ts）。
export function V4Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Escape 关菜单（和 JikeNav 一致）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const anchors = platformNavigation.map((n) => ({
    ...n,
    href: `#${n.href.split("#")[1]}`,
  }))

  return (
    <nav className={s.nav}>
      <div className={s.navInner}>
        <Link href="#top" className={s.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/brand/dujiao-gravity-logo.png" alt="" className={s.logoImg} />
          {siteConfig.name}
        </Link>
        <div className={s.navLinks}>
          {anchors.map((a) => (
            <a key={a.href} href={a.href}>
              {a.label}
            </a>
          ))}
        </div>
        <div className={s.navRight}>
          <UserNav />
          {/* 磁性效果挂在 span 上：ConsultationTrigger 不转发自定义属性 */}
          <span data-magnetic>
            {/* 第四版：主按钮打开轻量咨询。窄屏（≤400px）藏「我的」两字，只剩「聊聊场景」，给昵称留位置 */}
            <ConsultationTrigger
              context={{ source: "nav", intent: "demand", mode: "consult" }}
              className={`${s.btn} ${s.btnPrimary} ${s.btnSm} ${s.navCta}`}
            >
              {/* 外面再包一层 span：.btn 是 flex + gap，三段文字直接放进去会被拆开 */}
              <span>
                聊聊<span className={s.navCtaLong}>我的</span>场景
              </span>
            </ConsultationTrigger>
          </span>
          <button
            type="button"
            className={s.navBurger}
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className={s.navMenu}>
          <div
            className={s.navMenuBackdrop}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={s.navMenuPanel}>
            {anchors.map((a) => (
              <a key={a.href} href={a.href} onClick={() => setMenuOpen(false)}>
                {a.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
