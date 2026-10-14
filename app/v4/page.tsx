import { redirect } from "next/navigation"

// v4 预览路由已于 2026-10-15 升级为正式首页（app/(home)/page.tsx），
// 旧预览链接 /v4 重定向到首页，收藏过的人不落空
export default function V4Redirect() {
  redirect("/")
}
