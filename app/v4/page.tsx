import { redirect } from "next/navigation"

// /v4 是 2026-10-15 暗色霓虹首页的预览地址，后来转正为首页，第四版（2026-10-19）又被浅色的场景首页取代。
// 旧预览链接跳回首页，收藏过的人不落空
export default function V4Redirect() {
  redirect("/")
}
