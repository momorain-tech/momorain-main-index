import { projectProvider } from "@/config/platform"
import { siteConfig } from "@/config/site"
import type { ConsultContext } from "@/components/consultation/consultation-card"

// 项目详情的公开地址（复制进咨询内容里，对方在微信里点开就能看到是哪个项目）
export function projectUrl(slug: string): string {
  return `${siteConfig.url}/projects/${slug}`
}

// 带项目上下文的咨询。只接收已发布项目的数据（服务端查出来的），不接收 URL 参数
export function projectConsultContext(
  p: { slug: string; name: string },
  source: string
): ConsultContext {
  const provider = projectProvider(p.slug)
  return { source, intent: "demand", project: { slug: p.slug, name: p.name, url: projectUrl(p.slug) },
    ...(provider ? { provider: { name: provider.name, url: `${siteConfig.url}/providers/${provider.slug}` } } : {}),
  }
}
