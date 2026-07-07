import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser, isAdmin } from "@/lib/auth"

// 管理后台的守卫：所有 /admin/* 页面都套在这个 layout 里，
// 非超级用户一律跳回首页。
//
// 这里调用了 cookies()（在 getCurrentUser 内部），所以 /admin 下的路由
// 全部是每请求 SSR——这正是管理后台想要的（每次都看最新数据 + 最新登录态）。
// 注意这不违反"root layout 不许碰 cookies()"的红线：嵌套 layout 只影响
// 自己名下的路由，首页那批静态路由不受影响。
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user || !isAdmin(user)) redirect("/")

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">管理后台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前身份：{user.nickname}（超级用户）
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 返回首页
        </Link>
      </div>
      {children}
    </div>
  )
}
