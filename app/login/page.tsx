"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// 手机号验证码登录页
//
// 这个页面是纯客户端组件（"use client"），没有调用 cookies()/headers()，
// 所以它仍然是静态预渲染的，不会破坏全站的 ISR 模型
// （见 CLAUDE.md「渲染模型」一节：root layout 里读 cookie 会让整站退化成每请求 SSR）。
//
// 三个接口都走 next.config.mjs 里的 rewrite 转发到 Go 后端：
//   GET  /api/auth/captcha     领图形验证码
//   POST /api/auth/sms/send    发短信验证码
//   POST /api/auth/sms/verify  校验并登录
// 因为是同源请求，后端种下的 HttpOnly Cookie 会被浏览器正常保存。

/** 后端统一响应格式（对应 Go 侧的 controllers.Response） */
type ApiResponse<T = unknown> = {
  status: "ok" | "error"
  msg?: string
  data?: T
}

/**
 * 校验登录后要跳转的地址，防「开放重定向」漏洞。
 *
 * 如果直接用 ?next= 的值跳转，攻击者可以构造
 *   https://momorain.com/login?next=https://钓鱼站.com
 * 用户看到的是可信域名，登录完却被送到钓鱼站。
 * 所以只接受站内的相对路径，并且排除 //evil.com 这种"协议相对 URL"。
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/"
  if (!raw.startsWith("/")) return "/"
  if (raw.startsWith("//")) return "/"
  return raw
}

export default function LoginPage() {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [captchaCode, setCaptchaCode] = useState("")

  const [captchaId, setCaptchaId] = useState("")
  const [captchaImage, setCaptchaImage] = useState("")
  // 后端可以用 CAPTCHA_ENABLED=false 关掉图形验证码，
  // 此时 /api/auth/captcha 返回 404，前端要相应地隐藏这一栏
  const [captchaEnabled, setCaptchaEnabled] = useState(true)

  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const codeInputRef = useRef<HTMLInputElement>(null)

  // ── 图形验证码 ──────────────────────────────────────────────────────

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/captcha", { cache: "no-store" })
      if (res.status === 404) {
        setCaptchaEnabled(false)
        return
      }
      const body: ApiResponse<{ id: string; image: string }> = await res.json()
      if (body.status === "ok" && body.data) {
        setCaptchaId(body.data.id)
        setCaptchaImage(body.data.image)
        setCaptchaCode("")
      }
    } catch {
      setError("无法连接服务器，请稍后再试")
    }
  }, [])

  useEffect(() => {
    void loadCaptcha()
  }, [loadCaptcha])

  // ── 倒计时 ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // ── 发送验证码 ──────────────────────────────────────────────────────

  const phoneIsValid = /^1[3-9]\d{9}$/.test(phone)

  async function handleSend() {
    setError("")
    setNotice("")

    // 前端校验只是为了给用户即时反馈，后端会再校验一次。
    // 永远不要把前端校验当成安全边界——它可以被绕过。
    if (!phoneIsValid) {
      setError("请输入正确的手机号")
      return
    }
    if (captchaEnabled && captchaCode.length === 0) {
      setError("请先填写图形验证码")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, captchaId, captchaCode }),
      })
      const body: ApiResponse<{ cooldown?: number; retryAfter?: number; mockCode?: string }> =
        await res.json()

      if (body.status !== "ok") {
        setError(body.msg ?? "发送失败，请稍后再试")
        // 被限流时也把倒计时跑起来，让用户知道还要等多久
        if (body.data?.retryAfter) setCooldown(body.data.retryAfter)
        // 图形验证码一次一用，无论对错都已作废，必须换一张
        if (captchaEnabled) void loadCaptcha()
        return
      }

      setCooldown(body.data?.cooldown ?? 60)
      setNotice("验证码已发送，5 分钟内有效")
      codeInputRef.current?.focus()

      // 本地开发时后端会回显验证码，省得去翻服务端日志。
      // 生产环境后端不会返回这个字段。
      if (body.data?.mockCode) {
        setNotice(`【本地调试】验证码：${body.data.mockCode}`)
      }
    } catch {
      setError("网络错误，请检查网络后重试")
    } finally {
      setSending(false)
    }
  }

  // ── 提交登录 ────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!phoneIsValid) {
      setError("请输入正确的手机号")
      return
    }
    if (code.length < 4) {
      setError("请输入收到的验证码")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      })
      const body: ApiResponse = await res.json()

      if (body.status !== "ok") {
        setError(body.msg ?? "登录失败")
        return
      }

      // 用整页跳转而不是 router.push：
      // 导航栏的登录态是 UserNav 挂载时请求 /api/me 拿到的，
      // 客户端软跳转不会让它重新挂载，会出现"已登录但导航栏还显示登录按钮"。
      const params = new URLSearchParams(window.location.search)
      window.location.href = safeNextPath(params.get("next"))
    } catch {
      setError("网络错误，请检查网络后重试")
    } finally {
      setSubmitting(false)
    }
  }

  // ── 渲染 ────────────────────────────────────────────────────────────

  return (
    <div className="container flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">登录 momorain</h1>
          <p className="text-sm text-muted-foreground">
            未注册的手机号将自动创建账号
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 手机号 */}
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              手机号
            </label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="请输入手机号"
              maxLength={11}
              value={phone}
              // 只保留数字，避免用户粘贴进带空格/短横线的号码
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          {/* 图形验证码 */}
          {captchaEnabled && (
            <div className="space-y-2">
              <label htmlFor="captcha" className="text-sm font-medium">
                图形验证码
              </label>
              <div className="flex gap-2">
                <Input
                  id="captcha"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="请输入图中数字"
                  maxLength={6}
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value.trim())}
                />
                {/* 点击换一张。图形码是一次一用的，答错后必须重新领取 */}
                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  title="看不清？点击换一张"
                  className="h-9 shrink-0 overflow-hidden rounded-md border border-input bg-white"
                >
                  {captchaImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URI 图片，无需 next/image 优化
                    <img
                      src={captchaImage}
                      alt="图形验证码"
                      className="h-full w-auto"
                    />
                  ) : (
                    <span className="px-3 text-xs text-muted-foreground">加载中</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 短信验证码 */}
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium">
              短信验证码
            </label>
            <div className="flex gap-2">
              <Input
                id="code"
                ref={codeInputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位数字"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <Button
                type="button"
                variant="outline"
                className="w-28 shrink-0"
                onClick={() => void handleSend()}
                disabled={sending || cooldown > 0 || !phoneIsValid}
              >
                {cooldown > 0 ? `${cooldown} 秒` : sending ? "发送中" : "获取验证码"}
              </Button>
            </div>
          </div>

          {/* 提示信息 */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {notice && !error && (
            <p className="text-sm text-muted-foreground">{notice}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "登录中…" : "登录"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          登录即表示同意我们的服务条款
        </p>
      </div>
    </div>
  )
}
