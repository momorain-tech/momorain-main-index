import type { Metadata } from "next"
import { Inter as FontSans } from "next/font/google"

import "@/app/globals.css"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

// 根布局只留骨架（字体 + 主题），导航/页脚分两块各管各的：
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
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
