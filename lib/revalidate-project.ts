import { revalidatePath } from "next/cache"
import { projectProvider } from "@/config/platform"

// 项目同时出现在首页、提供者作品页和需求参考列表，状态变更须一起刷新。
// 提供者页只刷新这个项目所属的那一个；没有归属的项目不出现在任何提供者页上
export function revalidateProjectPages(slug: string) {
  revalidatePath("/")
  revalidatePath(`/projects/${slug}`)
  revalidatePath("/requests/new")
  const provider = projectProvider(slug)
  if (provider) revalidatePath(`/providers/${provider.slug}`)
}
