import "@/app/jike.css"

import { JikeNav } from "@/components/jike/nav"
import { JikeFooter } from "@/components/jike/footer"
import { HashScroll } from "@/components/jike/hash-scroll"
import { ConsultationProvider } from "@/components/consultation/consultation-provider"

// /old 旧首页备份的专用外壳：和旧版 (public)/layout 完全一致（不加载 jike-fresh.css），
// 保留 2026-10-15 迁移前的浅色设计稿皮肤。二级页面改版后这里是回退对照。
export default function OldLayout({ children }: { children: React.ReactNode }) {
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
