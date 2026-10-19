import { redirect } from "next/navigation"

// /old 是 2026-10-15 暗色首页上线时留的第三版首页备份。第四版（2026-10-19）首页换成
// 「场景 → 成果 → 合作 → 团队」之后，那份备份里还是「四位服务方」的旧说法，不再保留；
// 收藏过的人跳回首页。旧代码在 git 历史里（提交 1924b1b 的 app/old/page.tsx）
export default function OldHomeRedirect() {
  redirect("/")
}
