import "@/app/jike.css"
import "@/app/jike-fresh.css"

import { JikeNav } from "@/components/jike/nav"
import { JikeFooter } from "@/components/jike/footer"
import { HashScroll } from "@/components/jike/hash-scroll"
import { ConsultationProvider } from "@/components/consultation/consultation-provider"

// 公开页面（二级页）的外壳（/admin 走它自己的 layout，不经过这里；/old 有自己的备份外壳）：
// - .jk：设计稿样式作用域（app/jike.css 里所有选择器都挂在它下面）
// - jike-fresh.css：2026-10-15 的「清新浅色」皮肤，覆盖变量统一全组二级页面风格
// - .jk-skin：把 shadcn 设计令牌覆盖成同套调色板，
//   登录页/账号页的 Tailwind 类自动换肤，标记不用改
// - ConsultationProvider 挂在这一层：导航、详情页的「咨询定制」共用同一个对话框。
//   它是客户端组件，但不读 cookies()/headers()，不影响页面的静态渲染
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsultationProvider>
      <div className="jk jk-skin flex min-h-screen flex-col">
        <JikeNav />
        <main className="flex-1">{children}</main>
        <JikeFooter />
        <HashScroll />
      </div>
    </ConsultationProvider>
  )
}
