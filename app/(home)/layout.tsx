import "@/app/jike.css"

import { ConsultationProvider } from "@/components/consultation/consultation-provider"

// 首页（沉浸式暗色霓虹）的外壳。为什么引 jike.css：
// 咨询弹窗（ConsultationProvider/Trigger/Card）的 .consult-* 样式写在 jike.css 里，
// 这里引进来只为那几十条弹窗规则；.jk 开头的设计稿样式需要 .jk 类名才生效，首页不用它，不会串样式。
//
// 二级页面（/projects、/requests、/providers…）仍走 (public)/layout 的浅色外壳——
// 2026-10-15 定的主题策略：二级页面比首页更亮、清新自然，全站不做明暗切换。
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <ConsultationProvider>{children}</ConsultationProvider>
}
