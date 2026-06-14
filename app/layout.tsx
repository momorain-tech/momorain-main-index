import type { Metadata } from "next"
import { Inter as FontSans } from "next/font/google"

import "@/app/globals.css"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNav } from "@/components/main-nav"
import { SiteFooter } from "@/components/site-footer"

// next/font/google 会在构建时下载字体，不走第三方CDN，速度更快且隐私更好
const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

// Metadata 是 Next.js 内置的 SEO 系统，自动生成 <title> 和 <meta> 标签
export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

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
        {/* ThemeProvider 用 Context 把主题状态传给整个应用树 */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* 站点外壳：所有页面共享同一套 header/footer，页面只需渲染 <main> 内容 */}
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
