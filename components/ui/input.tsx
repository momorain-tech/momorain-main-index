import * as React from "react"

import { cn } from "@/lib/utils"

// 和 button.tsx 一样走 shadcn/ui 的风格：
// 组件只负责样式，行为完全交给原生 <input> 属性（value/onChange/disabled...）
// 这样它可以被任何表单库或纯 useState 使用，不绑定任何状态管理方案
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
