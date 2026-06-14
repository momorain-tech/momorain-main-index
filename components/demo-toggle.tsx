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
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      )}
    </div>
  )
}
