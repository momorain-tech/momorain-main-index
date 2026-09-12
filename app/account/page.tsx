import type { Metadata } from "next"

import { AccountView } from "@/components/account/account-view"

// 账号设置页 /account
//
// 本文件是服务端组件，只负责页面标题和外框，所以它能被静态预渲染；
// 所有和"当前是谁"有关的内容都在客户端组件 AccountView 里取。
// 不要在这里调用 cookies()——理由见 AccountView 顶部的注释。
export const metadata: Metadata = {
  title: "账号设置",
}

export default function AccountPage() {
  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">账号设置</h1>
      <AccountView />
    </div>
  )
}
