"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

// 锚点滚动统一处理。
//
// 导航/页脚里的锚点链接都是 <Link href="/#shelf"> 这种跨页形式：
// - 从别的页面跳过来：pathname 变化触发，滚到对应区块
// - 在首页内点击：#shelf 变化触发 hashchange，同样滚过去
// 当前页没有这个锚点（比如登录页）时静默跳过。
export function HashScroll() {
  const pathname = usePathname()

  useEffect(() => {
    const scroll = () => {
      const hash = window.location.hash
      if (!hash) return
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" })
    }
    scroll()
    window.addEventListener("hashchange", scroll)
    return () => window.removeEventListener("hashchange", scroll)
  }, [pathname])

  return null
}
