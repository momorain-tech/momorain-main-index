"use client"

import { Eye, EyeOff, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { fetchModelAccess, openAIEndpoint, type ModelAccessResult } from "@/lib/model-access"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { CopyButton } from "@/components/account/copy-button"

/**
 * 把 key 遮成 "sk-abcd••••••••wxyz"。
 *
 * 默认遮住是为了防「肩窥」和截图泄露：用户截图问问题、开着屏幕共享开会，
 * 完整 key 都会一起被发出去。复制按钮拿的是完整值，不受遮挡影响。
 */
function maskKey(key: string) {
  if (key.length <= 12) return "••••••••"
  return key.slice(0, 7) + "••••••••" + key.slice(-4)
}

// ready=false 时每种原因对应的提示。
// 按 reason（机器可读的代码）分支，而不是去匹配后端的中文文案——文案一改这里就悄悄失灵
const REASON_TEXT: Record<string, string> = {
  no_models: "模型服务暂未开放，管理员还没有配置可用的模型。",
  no_key: "你停用了自动创建的 Key。可以在控制台重新启用，或新建一个。",
  no_quota: "余额已用完，充值后即可继续使用。",
}

export function ModelAccessSection({ onNeedLogin }: { onNeedLogin: () => void }) {
  const [result, setResult] = useState<ModelAccessResult | null>(null)
  const [loading, setLoading] = useState(true)
  // 两个状态刻意分开：
  //   revealed    Key 是否显示明文——**只由它决定**，眼睛按钮切的就是它
  //   copyFailed  是否显示"请手动复制"的提示
  // 以前是 `revealed || copyFailed` 决定显示，结果复制"接口地址"失败也会把 Key
  // 露出来，而且之后点"隐藏"遮不回去（按钮图标变了，Key 却还是明文）。
  const [revealed, setRevealed] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetchModelAccess()
    setResult(r)
    setLoading(false)
    if (r.status === "need_login") onNeedLogin()
  }, [onNeedLogin])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">模型额度</h2>
          <p className="text-sm text-muted-foreground">
            在 momorain 旗下应用里调用大模型，都从这里扣费
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void load()}
          disabled={loading}
          title="刷新余额"
          aria-label="刷新余额"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* 首次加载：占位，避免内容到达时布局跳动 */}
      {result === null && <div className="h-24 animate-pulse rounded-md bg-muted" />}

      {result?.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {result.message}
        </p>
      )}

      {result?.status === "ok" && (
        <div className="space-y-5">
          {/* ── 余额 ──────────────────────────────────────────────── */}
          <div className="space-y-1">
            <div className="text-sm font-medium">可用余额</div>
            {/* quota 只在有 key 时才返回（它是"用户额度与 key 额度取小"算出来的）。
                没有 key 时去控制台看，不在这里自己算 */}
            <div className="text-3xl font-semibold tabular-nums">
              {result.data.quota?.display ?? "—"}
            </div>
            {!result.data.ready && result.data.reason && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {REASON_TEXT[result.data.reason] ?? "暂时无法使用模型服务。"}
              </p>
            )}
          </div>

          {/* ── API Key ────────────────────────────────────────────── */}
          {result.data.key && (
            <div className="space-y-2">
              <div className="text-sm font-medium">API Key</div>
              <div className="flex items-center gap-2">
                <code
                  className="flex h-8 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-md border bg-muted px-3 font-mono text-xs"
                  aria-label="API Key"
                >
                  {revealed ? result.data.key : maskKey(result.data.key)}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setRevealed((v) => !v)}
                  title={revealed ? "隐藏" : "显示完整 Key"}
                  aria-label={revealed ? "隐藏" : "显示完整 Key"}
                >
                  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {/* Key 复制失败时展开明文，让用户能手动选中复制。
                    展开的是 revealed 本身，所以之后照样可以点眼睛遮回去 */}
                <CopyButton
                  text={result.data.key}
                  onError={() => {
                    setRevealed(true)
                    setCopyFailed(true)
                  }}
                />
              </div>

              <div className="pt-2 text-sm font-medium">接口地址（OpenAI 兼容）</div>
              <div className="flex items-center gap-2">
                <code className="flex h-8 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-md border bg-muted px-3 font-mono text-xs">
                  {openAIEndpoint(result.data)}
                </code>
                {/* 接口地址本来就是明文显示的，复制失败只需要提示，不碰 Key */}
                <CopyButton text={openAIEndpoint(result.data)} onError={() => setCopyFailed(true)} />
              </div>

              {copyFailed && (
                <p className="text-xs text-muted-foreground">
                  浏览器不允许自动复制，请手动选中上面的内容复制。
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Key 和接口地址可以填进任何支持 OpenAI 格式的工具里使用，费用从上面的余额扣除。
                请勿泄露给他人。
              </p>
            </div>
          )}

          {/* ── 跳转 one-api ──────────────────────────────────────── */}
          {/* 必须用 <a> 而不是 <Link>：/one-api 是另一个应用，不是本站的路由。
              地址直接用 provision 给的 topupUrl / consoleUrl，不要自己拼 "/one-api/topup"：
              这两个地址会先按当前 momorain 身份换出 one-api 的会话再跳，
              自己拼的裸地址会让用户看到登录页，甚至是之前用 root 登录留下的别人的账号 */}
          <div className="flex flex-wrap gap-2">
            <a href={result.data.topupUrl} className={buttonVariants({ size: "sm" })}>
              充值 / 兑换码
            </a>
            <a
              href={result.data.consoleUrl}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              用量明细与 Key 管理
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
