"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

// 锚点滚动统一处理。
//
// 导航/页脚里的锚点链接都是 <Link href="/#projects"> 这种跨页形式：
// - 从别的页面跳过来：pathname 变化触发，滚到对应区块
// - 在首页内点击：#projects 变化触发 hashchange，同样滚过去
// 当前页没有这个锚点（比如登录页）时静默跳过。
//
// 旧锚点兼容（§9.3）：改版前的首页区块名已经被分享出去了（比如「/#shelf 神器货架」），
// 这些链接打开后要落到新首页对应的位置，而不是停在页面顶部。
// 用 replaceState 把地址栏也换成新锚点，用户再分享出去的就是新链接
const LEGACY_HASHES: Record<string, string> = {
  "#about": "#platform",
  "#top": "#platform",
  "#goals": "#platform",
  "#featured": "#projects",
  "#process": "#services",
  "#faq": "#services",
  "#shelf": "#projects", // 神器货架 → 项目案例
  "#who": "#services", // 按身份挑 → 服务内容
  "#pain": "#services", // 痛点区 → 服务内容
  "#contrast": "#services",
  "#custom": "#contact", // 专属定制 → 联系合作
  "#dev": "#contact", // 神器上架 → 联系合作
  "#subscribe": "#contact", // 邮箱订阅（已下线）→ 联系合作
  "#chat": "#contact",
}

export function HashScroll() {
  const pathname = usePathname()

  useEffect(() => {
    const scroll = () => {
      let hash = window.location.hash
      if (!hash) return
      const mapped = pathname === "/" ? LEGACY_HASHES[hash] : undefined
      if (mapped) {
        hash = mapped
        // 第一个参数传原来的 history.state：Next 的路由器把自己的数据存在里面，传 null 会弄坏后退
        history.replaceState(history.state, "", hash)
      }
      // 尊重「减少动态效果」的系统设置：这类用户直接跳过去，不做平滑滚动
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })
    }
    scroll()
    window.addEventListener("hashchange", scroll)
    return () => window.removeEventListener("hashchange", scroll)
  }, [pathname])

  return null
}
