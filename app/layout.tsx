import type { Metadata } from "next"
import { Inter as FontSans } from "next/font/google"

import "@/app/globals.css"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { getCurrentUser } from "@/lib/auth"
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

// layout 是 Server Component，可以直接 await 异步函数
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 每次请求服务端读取 Cookie 并验证 JWT，将用户信息向下传递
  // 如果未登录或 token 无效，user 为 null
  const user = await getCurrentUser()

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
                <MainNav user={user} />
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
