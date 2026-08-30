"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import type { SessionUser } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// 登录态在客户端通过 /api/me 获取，页面本身保持静态可缓存
// 代价：首帧登录区短暂占位空白，数据到达后再渲染真实状态
export function UserNav() {
  // undefined = 加载中，null = 未登录
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null)
          setIsAdmin(data.isAdmin ?? false)
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 占位尺寸与"登录"按钮一致，避免加载完成时导航栏跳动
  if (user === undefined) return <div className="h-8 w-[52px]" />

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {/* 只对超级用户显示入口；藏按钮只是体验，/admin 在服务端还有守卫 */}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            管理
          </Link>
        )}
        {/* 模型额度入口：登录后才显示。
            放这里而不是主导航，是因为它属于「我的账号」范畴——
            没登录的访客点进去只会看到一个要求登录的页面。 */}
        {/* 必须用 <a> 而不是 <Link>：/one-api 由 Traefik 路由到另一个独立应用，
            不是本站的 Next 路由。<Link> 会做客户端导航，Next 在自己的路由表里
            找不到它 → 404。这类跨应用链接一律用原生 <a> 触发整页跳转。 */}
        <a
          href="/one-api"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          title="管理模型 API Key 与额度"
        >
          模型额度
        </a>
        <span className="text-sm font-medium">{user.nickname}</span>
        {/* form POST 不需要 JS 状态，浏览器原生提交即可 */}
        <form method="POST" action="/auth/logout">
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            退出
          </button>
        </form>
      </div>
    )
  }

  return (
    // 用 Link 做客户端跳转即可——/login 是纯前端页面，
    // 真正种 Cookie 的是页面里对后端接口的 fetch
    <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
      登录
    </Link>
  )
}
