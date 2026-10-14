// Next.js 在服务启动时调用一次 register()（Node 和 Edge 两个运行时各打包一份）。
// 这里用它拉起资料接收的后台循环（AI 初评任务、过期素材清理），见 lib/intake/background.ts。
//
// 写法有讲究，必须是 `if (process.env.NEXT_RUNTIME === "nodejs") { await import(...) }`：
// 打包 Edge 那份时，Next 把 NEXT_RUNTIME 替换成字面量 "edge"，条件变成恒假，
// 整个 import 被当成死代码删掉——Edge 包里就不会混进 mysql2、node:fs 这些它跑不了的模块。
// 写成「不等于就 return」的提前返回，打包器认不出来，构建会报 UnhandledSchemeError。
//
// NEXT_PHASE 判断：`next build` 预渲染时也可能加载 instrumentation，构建进程里不该起定时任务
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startIntakeBackground } = await import("./lib/intake/background")
    startIntakeBackground()
  }
}
