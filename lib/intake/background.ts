import "server-only"

import { isDbConfigured } from "@/lib/db"
import { aiConfig, releaseExpiredLeases, runNextJob } from "@/lib/intake/analysis"
import { takeAbandonedAssets } from "@/lib/intake/store"
import { cleanTmp, removeObject, uploadDir } from "@/lib/intake/uploads"

// 资料接收的后台循环，由根目录 instrumentation.ts 在服务启动时调用一次。
//
// 两件事：
//   · 每 5 秒：领 AI 初评任务执行（没配模型就不跑）
//   · 每小时：把租约过期的任务转「待核对」；清理上传了却 7 天没提交的素材、tmp 里的半截文件
//
// 它跑在 Next 服务进程里，所以和网站同生共死、不需要在 Dokploy 多开一个服务。
// 多副本也安全：任务靠数据库条件更新抢锁（见 analysis.ts），清理是幂等的。
// 一次只跑一个任务（running 标志），模型慢的时候不会越堆越多并发。

const g = globalThis as unknown as { __intakeBackground?: boolean }

export function startIntakeBackground() {
  if (g.__intakeBackground || !isDbConfigured()) return
  g.__intakeBackground = true

  let running = false
  const tick = async () => {
    if (running || !aiConfig()) return
    running = true
    try {
      // 一口气把队列里的跑完（每个任务内部有超时），空了再等下一个 5 秒
      while (await runNextJob()) {}
    } catch (err) {
      // 数据库暂时连不上之类：记一笔，下个周期再试。不能让异常把整个进程带走
      console.error("[intake] AI 任务循环出错", err)
    } finally {
      running = false
    }
  }
  const hourly = async () => {
    try {
      await releaseExpiredLeases()
      if (uploadDir()) {
        for (const key of await takeAbandonedAssets()) await removeObject(key)
        await cleanTmp()
      }
    } catch (err) {
      console.error("[intake] 定时清理出错", err)
    }
  }
  // unref：这些定时器不阻止进程退出（Docker 停容器时能正常结束）
  setInterval(tick, 5000).unref()
  setInterval(hourly, 3600 * 1000).unref()
  setTimeout(hourly, 30 * 1000).unref()
  console.log(
    `[intake] 后台循环已启动：AI 初评${aiConfig() ? "已开启" : "未配置（不运行）"}，上传${uploadDir() ? "已开启" : "未开启"}`,
  )
}
