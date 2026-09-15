"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export function DemoToggle({ url }: { url: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(buttonVariants({ variant: open ? "secondary" : "default", size: "lg" }))}
        >
          {open ? "收起 Demo ▲" : "查看 Demo ▶"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          新标签打开 ↗
        </a>
      </div>

      {open && (
        <div className="mt-4 overflow-hidden rounded-xl border shadow-md">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
            <span className="truncate text-xs text-muted-foreground">{url}</span>
            <button
              onClick={() => setOpen(false)}
              className="ml-4 text-muted-foreground hover:text-foreground"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
          <iframe
            src={url}
            className="h-[600px] w-full"
            title="Demo 预览"
            // iframe 里的页面默认拿不到麦克风、写不了剪贴板、也不能触发下载——不管里面的站点自己怎么写。
            // 这些权限要由外层（也就是这里）显式放行：
            //   microphone       → 表达训练、Talk to 峰哥要录音
            //   clipboard-write  → 视频转手绘的「复制文案」
            //   allow-downloads  → 简历工坊下载 PDF、视频类项目下载成片
            allow="microphone; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          />
        </div>
      )}
    </div>
  )
}
