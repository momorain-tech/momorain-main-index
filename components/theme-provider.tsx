"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

// 这是一个"包装器"组件：因为 next-themes 需要客户端环境，
// 所以我们用 "use client" 把它包起来，让服务端组件能安全引用它
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
