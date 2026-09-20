import "@/app/jike.css"

import { JikeNav } from "@/components/jike/nav"
import { JikeFooter } from "@/components/jike/footer"
import { ToastProvider } from "@/components/jike/toast"
import { HashScroll } from "@/components/jike/hash-scroll"

// 公开页面的外壳（/admin 走它自己的 layout，不经过这里）：
// - .jk：设计稿样式作用域（app/jike.css 里所有选择器都挂在它下面）
// - .jk-skin：把 shadcn 设计令牌覆盖成同套调色板，
//   详情页/登录页/账号页的 Tailwind 类自动换肤，标记不用改
// - ToastProvider 挂在这一层：首页货架和页脚订阅共用同一个 toast
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="jk jk-skin flex min-h-screen flex-col">
        <JikeNav />
        <main className="flex-1">{children}</main>
        <JikeFooter />
        <HashScroll />
      </div>
    </ToastProvider>
  )
}
