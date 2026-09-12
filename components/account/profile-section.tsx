"use client"

import { useState } from "react"

import type { SessionUser } from "@/lib/auth"
import { announceUserUpdated } from "@/lib/user-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// 必须和 user-login 的 object.NicknameMaxLen 一致。
// 前端这份只是为了即时提示，真正的校验在后端——前端校验可以被绕过。
const NICKNAME_MAX_LEN = 20

/**
 * 按「字符」数长度，和 Go 那边的 utf8.RuneCountInString 口径一致。
 *
 * 为什么不用 s.length？JS 字符串的 length 数的是 UTF-16 编码单元，
 * 一个 emoji（比如 🎉）占两个单元，length 是 2；而 Go 数的是 Unicode 码点，是 1。
 * 用 length 的话，带 emoji 的昵称前端说"超长了"，后端其实能收。
 * Array.from() 按码点拆分字符串，两边就对上了。
 *
 * 同理，<input> 上**不要**加 maxLength：它也按 UTF-16 单元截断，
 * 会把 emoji 从中间劈成半个乱码字符。
 */
function charCount(s: string) {
  return Array.from(s).length
}

type ApiResponse<T> = { status: "ok" | "error"; msg?: string; data?: T }

export function ProfileSection({
  user,
  onNeedLogin,
}: {
  user: SessionUser
  onNeedLogin: () => void
}) {
  // saved 是"服务器上当前的昵称"，draft 是输入框里正在编辑的内容。
  // 分开存才能判断"有没有改动"，没改动时保存按钮置灰。
  const [saved, setSaved] = useState(user.nickname)
  const [draft, setDraft] = useState(user.nickname)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const trimmed = draft.trim()
  const length = charCount(trimmed)
  const tooLong = length > NICKNAME_MAX_LEN
  const canSave = !saving && trimmed !== "" && !tooLong && trimmed !== saved

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setError("")
    setNotice("")
    setSaving(true)

    try {
      // ⚠️ 路径是站点根的绝对路径 /api/auth/*——它由 Traefik 直接路由到
      // user-login，不经过本站（本地开发时经 next.config.mjs 的 rewrite）
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      })
      // user-login 的 HTTP 状态码是有意义的（和 one-api 不一样），
      // 401 说明登录态已经失效，送去登录页
      if (res.status === 401) {
        onNeedLogin()
        return
      }
      const body: ApiResponse<{ nickname: string }> = await res.json()
      if (body.status !== "ok" || !body.data) {
        setError(body.msg ?? "保存失败，请稍后再试")
        return
      }

      // 以服务器返回的为准（后端会去掉首尾空白），而不是用户输入的原文
      const next = body.data.nickname
      setSaved(next)
      setDraft(next)
      setNotice("已保存")
      // 通知导航栏更新右上角的名字。
      // 后端已经重签了 session Cookie，所以就算不发这个事件，
      // 刷新页面后显示的也是新昵称——事件只是让它"不用刷新就变"。
      announceUserUpdated({ nickname: next })
    } catch {
      setError("网络错误，请检查网络后重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">基本资料</h2>
        <p className="text-sm text-muted-foreground">
          昵称会显示在 momorain 旗下所有站点的右上角
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="nickname" className="text-sm font-medium">
          昵称
        </label>
        <div className="flex gap-2">
          <Input
            id="nickname"
            autoComplete="nickname"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setNotice("")
              setError("")
            }}
            aria-invalid={tooLong}
            aria-describedby="nickname-hint"
          />
          <Button type="submit" className="w-20 shrink-0" disabled={!canSave}>
            {saving ? "保存中" : "保存"}
          </Button>
        </div>
        <div id="nickname-hint" className="flex justify-between text-xs">
          <span>
            {error ? (
              <span className="text-red-600 dark:text-red-400" role="alert">
                {error}
              </span>
            ) : notice ? (
              <span className="text-muted-foreground">{notice}</span>
            ) : null}
          </span>
          <span className={tooLong ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
            {length}/{NICKNAME_MAX_LEN}
          </span>
        </div>
      </form>

      {/* 手机号只读：JWT 里的就是脱敏过的，完整号码前端根本拿不到。
          换绑手机号涉及给新旧号码都发验证码，不在这一期 */}
      {user.phone && (
        <div className="space-y-1">
          <div className="text-sm font-medium">手机号</div>
          <div className="text-sm text-muted-foreground">{user.phone}</div>
        </div>
      )}
    </section>
  )
}
