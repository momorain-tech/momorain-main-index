import type { Metadata } from "next"

import "@/app/globals.css"
import { siteConfig } from "@/config/site"
import { ThemeProvider } from "@/components/theme-provider"

// 为什么不用 next/font/google：它在 `pnpm build` 时要去 fonts.googleapis.com 下载字体，
// 部署服务器在国内连不上 Google，构建会超时失败（2026-10-13 的部署就卡在这里）。
// 改用系统字体栈（定义在 globals.css 的 --font-sans）：构建不再依赖外网；
// 中文本来就要回落到系统字体（Inter 只覆盖拉丁字母）；公开页面（.jk）也早就用系统字体了，
// 实际受影响的只有后台和登录页里的英文与数字。

export const metadata: Metadata = {
  title: {
    // 站名与页面统一，保留母品牌署名
    default: `${siteConfig.name} · ${siteConfig.brand}`,
    template: `%s | ${siteConfig.name} · ${siteConfig.brand}`,
  },
  description: siteConfig.description,
}

// 根布局只留骨架（全局样式 + 主题），导航/页脚分两块各管各的：
// - 公开页面 → app/(public)/layout.tsx（设计稿外壳 + .jk-skin 换肤）
// - 管理后台 → app/admin/layout.tsx（自带头部，样式保持旧 shadcn）
//
// 注意：layout 里不要调用 cookies()/headers() 等动态 API，
// 否则全站所有路由都会退出静态渲染。登录态由 UserNav 走 /api/me 获取。
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head />
      <body
        className="min-h-screen bg-background font-sans antialiased"
      >
        {/* 默认亮色：设计稿浅色版是主视觉（不跟随系统，用户可手动切深色） */}
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
