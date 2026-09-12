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
      // min-w-0：flex 子元素默认"至少和内容一样宽"，不加的话里面的昵称
      // 永远不会收缩，截断也就不会生效（这是 flex + truncate 最常见的坑）
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* 只对超级用户显示入口；藏按钮只是体验，/admin 在服务端还有守卫 */}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            管理
          </Link>
        )}
        {/* 点昵称进账号页（改昵称、看模型余额、复制 key）。
            原来这里有一个直接指向 /one-api 的「模型额度」按钮，已并入账号页：
            裸链到 /one-api 时，用户看到的是 one-api 自己的会话——可能是登录页，
            也可能是之前用 root 登录留下的别人的账号。账号页里的链接用的是
            provision 返回的 consoleUrl，会先按当前身份换好会话再跳。 */}
        {/* 昵称最长 20 个字，导航栏放不下，所以限宽 + 省略号：
            手机上最多约 5 个汉字宽，桌面约 10 个；空间不够时继续收缩，但不小于 3rem
            （至少露出一两个字 + 省略号——收缩到 0 就等于入口消失了）。
            完整昵称放在 title 里，悬停可见 */}
        <Link
          href="/account"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "min-w-[3rem] max-w-[6rem] text-sm sm:max-w-[11rem]"
          )}
          title={`${user.nickname} · 账号设置`}
        >
          <span className="truncate">{user.nickname}</span>
        </Link>
        {/* form POST 不需要 JS 状态，浏览器原生提交即可 */}
        <form method="POST" action="/auth/logout">
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
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
