"use client"

import { useEffect, useRef } from "react"

// 滚动渐显。设计稿用全局 IntersectionObserver 观察 document 里所有 .reveal，
// 这里收敛到本组件容器内，只影响首页自己的元素。
// 进入视口后加 .on 并停止观察（一次渐显，不回退）。
export function RevealRoot({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>(".reveal")
    if (els.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("on")
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return <div ref={ref}>{children}</div>
}
