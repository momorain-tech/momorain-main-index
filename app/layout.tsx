import type { Metadata } from "next"
import { Inter as FontSans } from "next/font/google"

import "@/app/globals.css"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNav } from "@/components/main-nav"
import { SiteFooter } from "@/components/site-footer"

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
          <div className="flex min-h-screen flex-col">
            <header className="container z-40 bg-background">
              <div className="flex h-20 items-center justify-between py-6">
                <MainNav />
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
