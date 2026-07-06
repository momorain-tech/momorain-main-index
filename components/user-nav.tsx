"use client"

import { useEffect, useState } from "react"

import type { SessionUser } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// 登录态在客户端通过 /api/me 获取，页面本身保持静态可缓存
// 代价：首帧登录区短暂占位空白，数据到达后再渲染真实状态
export function UserNav() {
  // undefined = 加载中，null = 未登录
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setUser(data.user ?? null)
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
    // 用 <a> 而非 Link，确保触发完整页面跳转走后端登录流程
    <a
      href="/api/auth/mock/login?redirect=true"
      className={cn(buttonVariants({ size: "sm" }))}
    >
      登录
    </a>
  )
}
