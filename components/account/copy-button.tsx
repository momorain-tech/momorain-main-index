"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

// 复制到剪贴板的按钮，点完 2 秒内显示"已复制"
//
// navigator.clipboard 只在「安全上下文」里可用：https 页面或 localhost。
// 线上是 https、本地开发是 localhost，都没问题；
// 但如果有人用局域网 IP（http://192.168.x.x:3000）访问开发服务器，它就是 undefined。
// 所以失败时不能静默——交给调用方决定怎么兜底（比如把内容明文展示出来让用户手动选）。
export function CopyButton({
  text,
  label = "复制",
  onError,
}: {
  text: string
  label?: string
  onError?: () => void
}) {
  const [copied, setCopied] = useState(false)

  // 用 effect 管理计时器而不是在 onClick 里直接 setTimeout：
  // 组件在 2 秒内被卸载的话，effect 的清理函数会取消计时器，
  // 不会去更新一个已经不存在的组件
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      onError?.()
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleCopy()}
      className="shrink-0 gap-1"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "已复制" : label}
    </Button>
  )
}
