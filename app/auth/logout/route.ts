import { NextResponse } from "next/server"

// POST /auth/logout
// JWT 是无状态的，退出只需删掉浏览器的 Cookie，不需要通知后端
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url))
  response.cookies.delete("session")
  return response
}
