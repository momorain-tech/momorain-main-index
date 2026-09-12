import type { SessionUser } from "@/lib/auth"

// 「当前用户的资料变了」的页面内广播
//
// 要解决的问题：账号页改完昵称后，导航栏右上角还显示旧名字。
// 两个组件在 React 树上离得很远（导航栏在 layout 里，账号页在 page 里），
// 没有共同的父组件可以传 props。
//
// 可选方案：
//   · 全局状态库（Redux / Zustand）——为一个昵称引入一整套状态管理，太重
//   · React Context——需要在 layout 包一层 Provider，而 layout 是服务端组件，
//     包进去的 Provider 必须是客户端组件，改动面不小
//   · 整页刷新——能用，但用户会看到页面闪一下
//   · 浏览器原生的 CustomEvent——一个发、一个听，零依赖 ✅
//
// 事件只在当前标签页内传播。别的标签页里的导航栏要等它下次加载时
// 请求 /api/me 才会更新，这对昵称来说完全够用。

export const USER_UPDATED_EVENT = "momorain:user-updated"

export type UserUpdatedDetail = Partial<Pick<SessionUser, "nickname" | "avatarUrl">>

export function announceUserUpdated(detail: UserUpdatedDetail) {
  window.dispatchEvent(new CustomEvent<UserUpdatedDetail>(USER_UPDATED_EVENT, { detail }))
}
