"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import type { SessionUser } from "@/lib/auth"
import { USER_UPDATED_EVENT, type UserUpdatedDetail } from "@/lib/user-events"
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

  // 账号页改完昵称会广播一个事件（见 lib/user-events.ts），这里接住它更新显示。
  // 不用重新请求 /api/me：事件里已经带着新值了。
  useEffect(() => {
    function onUpdated(e: Event) {
      const detail = (e as CustomEvent<UserUpdatedDetail>).detail
      // 函数式更新：基于"最新的 user"合并，而不是闭包里捕获的那个旧值
      setUser((prev) => (prev ? { ...prev, ...detail } : prev))
    }
    window.addEventListener(USER_UPDATED_EVENT, onUpdated)
    // 组件卸载时必须移除监听，否则每次挂载都多挂一个，越积越多
    return () => window.removeEventListener(USER_UPDATED_EVENT, onUpdated)
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
        {/* 点昵称进账号页（改昵称、看模型余额、复制 key）。
            原来这里有一个直接指向 /one-api 的「模型额度」按钮，已并入账号页：
            裸链到 /one-api 时，用户看到的是 one-api 自己的会话——可能是登录页，
            也可能是之前用 root 登录留下的别人的账号。账号页里的链接用的是
            provision 返回的 consoleUrl，会先按当前身份换好会话再跳。 */}
        <Link
          href="/account"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-sm")}
          title="账号设置 · 模型额度"
        >
          {user.nickname}
        </Link>
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
