"use client"

import { useCallback, useEffect, useState } from "react"

import type { SessionUser } from "@/lib/auth"
import { ModelAccessSection } from "@/components/account/model-access-section"
import { ProfileSection } from "@/components/account/profile-section"

// 账号页的客户端主体
//
// 为什么整页的数据都在客户端取？和 UserNav 同一个理由（见 CLAUDE.md「渲染模型」）：
// 服务端组件里一旦读 cookies()，这个页面就退出静态渲染，变成每请求 SSR。
// 账号页的访问量不大，SSR 其实也无所谓；但保持"全站只有 /admin 读 cookies"
// 这条规则简单好记，比为一个页面开例外更有价值。
//
// 代价是首帧是一个骨架屏，数据到了才渲染真实内容。

function goLogin() {
  // 整页跳走，登录成功后由登录页的 ?next= 带回来
  window.location.href = "/login?next=" + encodeURIComponent("/account")
}

export function AccountView() {
  // undefined = 加载中，null = 未登录（和 UserNav 的约定一样）
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    // ⚠️ 临时措施：www.momorain.com 上没有挂 /one-api，余额和 key 取不到。
    // 登录态 Cookie 是 .momorain.com 域的，两个域名都认，所以直接跳到主域名即可。
    // 等 www → momorain.com 的全站 301 做完（PLATFORM.md §7），这段可以删掉。
    if (window.location.hostname === "www.momorain.com") {
      window.location.replace(
        "https://momorain.com" + window.location.pathname + window.location.search
      )
      return
    }

    let cancelled = false
    fetch("/api/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then((data: { user: SessionUser | null }) => {
        if (cancelled) return
        if (!data.user) {
          setUser(null)
          goLogin()
          return
        }
        setUser(data.user)
      })
      .catch(() => {
        // 「接口出错」和「没登录」要分开：出错时把用户送去登录页，
        // 他登录完回来还是出错，就会陷入一个怎么登都进不来的循环
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 子组件发现登录态失效时（比如 Cookie 过期了）调用它。
  // 用 useCallback 固定引用：ModelAccessSection 把它放在 useEffect 的依赖里，
  // 引用每次渲染都变的话会导致无限重复请求
  const handleNeedLogin = useCallback(() => goLogin(), [])

  if (loadError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        加载账号信息失败，请稍后刷新重试
      </p>
    )
  }

  if (!user) {
    // 加载中 / 正在跳转登录页：都显示骨架屏
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ProfileSection user={user} onNeedLogin={handleNeedLogin} />
      <ModelAccessSection onNeedLogin={handleNeedLogin} />
    </div>
  )
}
