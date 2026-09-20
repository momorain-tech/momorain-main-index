"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

// 全局 toast。设计稿里是一个全局函数 toast(msg)，
// 这里收敛成 Context + Provider，挂在 (public)/layout 上，
// 首页各区块和页脚的订阅按钮共用同一个 notify。
const ToastContext = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("")
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const notify = useCallback((m: string) => {
    setMsg(m)
    setShow(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 3000)
  }, [])

  // 卸载时清掉计时器，避免页面切换后还在 setState
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={`jk-toast${show ? " show" : ""}`} role="status" aria-live="polite">
        {msg}
      </div>
    </ToastContext.Provider>
  )
}
