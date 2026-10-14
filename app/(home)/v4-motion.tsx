"use client"

import { useEffect, useRef, type ReactNode } from "react"
import s from "./v4.module.css"

// /v4 预览页的动效层：滚动浮现、极光视差、磁性按钮、平滑滚动。
// 全部走 IntersectionObserver + rAF，不引入额外依赖；prefers-reduced-motion 时整体关闭。
export function NeonReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // 平滑滚动：只在这个页面生效，离开时还原，不污染其他路由
    const html = document.documentElement
    const prev = html.style.scrollBehavior
    if (!reduced) html.style.scrollBehavior = "smooth"

    // 旧锚点兼容（与 (public) 的 HashScroll 同一张表）：旧首页区块名已外流（如 /#shelf），
    // 打开后落到新首页对应位置，地址栏同步换成新锚点；#faq 滚过去前先展开折叠面板
    const LEGACY_HASHES: Record<string, string> = {
      "#about": "#platform",
      "#top": "#platform",
      "#goals": "#platform",
      "#featured": "#projects",
      "#process": "#services",
      "#shelf": "#projects",
      "#who": "#services",
      "#pain": "#services",
      "#contrast": "#services",
      "#custom": "#contact",
      "#dev": "#contact",
      "#subscribe": "#contact",
      "#chat": "#contact",
    }
    const initialHash = window.location.hash
    if (initialHash) {
      const target = LEGACY_HASHES[initialHash] ?? initialHash
      const el = root.querySelector<HTMLElement>(target)
      if (el) {
        if (el instanceof HTMLDetailsElement) el.open = true
        window.history.replaceState(null, "", target)
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
      }
    }

    // 滚动浮现 + 交错延迟
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]")
    let io: IntersectionObserver | undefined
    if (reduced) {
      els.forEach((el) => el.classList.add(s.revealIn))
    } else {
      els.forEach((el, i) => {
        el.style.transitionDelay = `${(i % 4) * 70}ms`
      })
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add(s.revealIn)
              io?.unobserve(e.target)
            }
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      )
      els.forEach((el) => io!.observe(el))
    }

    // 极光视差：外层容器随滚动位移（内层跑 CSS 漂移动画，两层 transform 互不覆盖）
    let raf = 0
    const orbs = root.querySelectorAll<HTMLElement>("[data-orb]")
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        orbs.forEach((orb) => {
          const speed = Number(orb.dataset.orb ?? 0)
          orb.style.transform = `translate3d(0, ${y * speed}px, 0)`
        })
      })
    }
    if (!reduced) {
      onScroll()
      window.addEventListener("scroll", onScroll, { passive: true })
    }

    // 首屏统计数字滚动：0 → data-count 目标值，只跑一次。
    // SSR 已输出最终值，这里先归零再滚上去；Math.min 兜底保证任何一帧都不超过目标值
    let countRaf = 0
    const counters = root.querySelectorAll<HTMLElement>("[data-count]")
    if (!reduced && counters.length > 0) {
      const duration = 1400
      const start = performance.now() + 350 // 等浮现动画起步再开始滚
      const tick = (now: number) => {
        const t = Math.min(Math.max((now - start) / duration, 0), 1)
        const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
        counters.forEach((el) => {
          const target = Number(el.dataset.count ?? 0)
          el.textContent = String(Math.min(Math.round(target * eased), target))
        })
        if (t < 1) {
          countRaf = requestAnimationFrame(tick)
        }
      }
      countRaf = requestAnimationFrame(tick)
    }

    // 磁性按钮：向光标方向小幅偏移
    const magnets = root.querySelectorAll<HTMLElement>("[data-magnetic]")
    const offs: Array<() => void> = []
    if (!reduced) {
      magnets.forEach((el) => {
        const move = (e: MouseEvent) => {
          const r = el.getBoundingClientRect()
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height
          el.style.transform = `translate3d(${dx * 10}px, ${dy * 8}px, 0)`
        }
        const leave = () => {
          el.style.transform = "translate3d(0,0,0)"
        }
        el.addEventListener("mousemove", move)
        el.addEventListener("mouseleave", leave)
        offs.push(() => {
          el.removeEventListener("mousemove", move)
          el.removeEventListener("mouseleave", leave)
        })
      })
    }

    return () => {
      html.style.scrollBehavior = prev
      io?.disconnect()
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(countRaf)
      offs.forEach((off) => off())
    }
  }, [])

  return <div ref={ref}>{children}</div>
}
