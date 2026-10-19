import { permanentRedirect } from "next/navigation"

import { legacyProviderSlugs } from "@/config/platform"

// 原服务方页 /providers/<slug>。第四版（2026-10-19）起对外统一是一个核心团队，
// 四个服务方展示身份和更早的 /providers/momorain 都不再单独成页：
// 已经转发出去的旧链接永久跳转（308）到首页「核心团队」区，不落进 404。
//
// 同目录下的 /providers/join（服务方合作）是静态路由，Next.js 会优先匹配它，不会被这里的 [slug] 抢走
type Props = { params: Promise<{ slug: string }> }

// 名单之外的地址一律 404，不在运行时按需渲染
export const dynamicParams = false
export function generateStaticParams() {
  return legacyProviderSlugs.map((slug) => ({ slug }))
}

export default async function LegacyProviderPage({ params }: Props) {
  await params
  permanentRedirect("/#team")
}
