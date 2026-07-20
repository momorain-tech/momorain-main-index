import { NextResponse } from "next/server"

// POST /auth/logout
// JWT 是无状态的，退出只需删掉浏览器的 Cookie，不需要通知后端
export async function POST(request: Request) {
  // request.url 是 Next.js 内部地址（localhost:3000），直接用会让浏览器跳 localhost
  // 浏览器发 form POST 时携带 Origin 头，里面是真实的外部域名
  const origin = request.headers.get("origin") ?? request.url
  const response = NextResponse.redirect(new URL("/", origin))
  response.cookies.delete("session")
  return response
}
