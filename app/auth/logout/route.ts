// POST /auth/logout — 兼容旧页面的退出入口。
// 保留 POST 转到统一认证接口，由 user-login 按登录时的 Domain/Path 清理 Cookie。
// 相对 Location 保持浏览器当前域名，不依赖 Origin 或反向代理的内部地址。
// 此处 307 是为了保留 POST；认证接口清理完成后用 303 跳回首页。
export async function POST() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: "/api/auth/logout",
      "Cache-Control": "no-store",
    },
  })
}
