"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

import { ConsultationCard, consultationTitle, type ConsultContext } from "@/components/consultation/consultation-card"
import { CONSULT_DRAFT_KEY, ConsultForm } from "@/components/consultation/consult-form"
import { isConsultDraft, type ConsultDraft } from "@/lib/intake-validation"

// 全站共用一个咨询对话框，挂在 (public)/layout 上；
// 导航、首屏、场景演示、详情页的按钮都调 useConsultation() 拿到的 open(context)。
// context.mode = "consult" 时弹窗里是轻量咨询表单（第四版），否则只有微信联系卡。
//
// 用浏览器原生 <dialog> + showModal()，而不是自己用 div 拼一个弹层，因为原生的自带：
// - 按 Escape 关闭
// - 弹层外面的内容不可点、读屏软件也读不到（等于自动做了「焦点锁定」）
// - 显示在所有内容最上层，不用操心 z-index
// 原生没做的两件事在这里补：点遮罩关闭、关闭后把焦点还给打开它的按钮（§4.4）

const ConsultationContext = createContext<(ctx: ConsultContext, draft?: ConsultDraft) => void>(() => {})

export function useConsultation() {
  return useContext(ConsultationContext)
}

export function ConsultationProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const originalOverflowRef = useRef<string | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [context, setContext] = useState<ConsultContext | null>(null)
  // 登录回来恢复的轻量咨询草稿，只用一次（下一次打开弹窗就是空白的新表单）
  const [draft, setDraft] = useState<ConsultDraft | undefined>(undefined)
  // 每次打开都换一个 key，让卡片重新挂载：上一次填的需求、复制状态不会带到下一个项目
  const [openCount, setOpenCount] = useState(0)

  const open = useCallback((ctx: ConsultContext, restored?: ConsultDraft) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setContext(ctx)
    setDraft(restored)
    setOpenCount((n) => n + 1)
  }, [])

  // 轻量咨询「没登录 → 去登录 → 回来」：登录页把人带回原页面并带上 ?consult=resume，
  // 这里读出本地草稿、重新打开弹窗。读完就把参数从地址栏去掉，刷新不会再弹一次
  // （replaceState 第一个参数传原来的 history.state，传 null 会弄坏 Next 的后退，见 hash-scroll.tsx）
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("consult") !== "resume") return
    url.searchParams.delete("consult")
    history.replaceState(history.state, "", url.pathname + url.search + url.hash)
    let restored: ConsultDraft | undefined
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(CONSULT_DRAFT_KEY) ?? "null")
      if (isConsultDraft(parsed)) restored = parsed
    } catch {
      /* 存储不可用：打开一个空白的咨询框，用户重填 */
    }
    open({ source: "resume", intent: "demand", mode: "consult" }, restored)
  }, [open])

  // context 渲染进 DOM 之后再 showModal，否则对话框里的内容还是上一次的
  useEffect(() => {
    const dialog = dialogRef.current
    if (openCount > 0 && dialog && !dialog.open) {
      originalOverflowRef.current = document.body.style.overflow
      document.body.style.overflow = "hidden"
      dialog.showModal()
    }
  }, [openCount])

  useEffect(() => () => {
    if (originalOverflowRef.current !== null) document.body.style.overflow = originalOverflowRef.current
  }, [])

  function close() {
    dialogRef.current?.close()
  }

  // close 事件：不管是点关闭按钮、点遮罩还是按 Escape，最后都会走到这里
  function handleClose() {
    if (originalOverflowRef.current !== null) {
      document.body.style.overflow = originalOverflowRef.current
      originalOverflowRef.current = null
    }
    // preventScroll：还焦点时不要把页面滚到按钮那里，保持用户原来的滚动位置
    returnFocusRef.current?.focus({ preventScroll: true })
  }

  return (
    <ConsultationContext.Provider value={open}>
      {children}
      <dialog
        ref={dialogRef}
        className="consult-dialog"
        aria-labelledby="consult-dialog-title"
        onClose={handleClose}
        // 点到 dialog 元素本身（而不是里面的内容）= 点在遮罩上
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="consult-dialog-inner">
          <div className="consult-dialog-head">
            <h2 id="consult-dialog-title">{consultationTitle(context)}</h2>
            <button type="button" className="consult-close" aria-label="关闭" onClick={close}>
              <X size={20} />
            </button>
          </div>
          {context?.mode === "consult" ? (
            // 轻量咨询：表单在上，微信联系折叠在下面，始终可用（第四版 §7）。
            // 外面套一层 .jk：<dialog> 渲染在 (public)/layout 的 .jk 容器外面，
            // 不套的话表单输入框、按钮那些 `.jk .intake-*` / `.jk .btn-*` 样式都不生效（.consult-jk 去掉 .jk 的整页属性）
            <div key={openCount} className="jk consult-jk">
              <ConsultForm scene={context.scene} project={context.project} draft={draft} />
              <details className="consult-wechat-alt">
                <summary>不想填表？直接加微信联系</summary>
                <ConsultationCard context={context} />
              </details>
            </div>
          ) : (
            context && <ConsultationCard key={openCount} context={context} />
          )}
        </div>
      </dialog>
    </ConsultationContext.Provider>
  )
}

// 打开咨询对话框的按钮。服务端组件里也能直接用（它自己是客户端组件，
// context 是普通对象，可以从服务端作为 props 传进来）
export function ConsultationTrigger({
  context,
  className,
  children,
}: {
  context: ConsultContext
  className?: string
  children: React.ReactNode
}) {
  const open = useConsultation()
  return (
    <button type="button" className={className} onClick={() => open(context)}>
      {children}
    </button>
  )
}
