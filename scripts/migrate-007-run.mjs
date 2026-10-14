// 007 迁移的线上执行器（一次性使用，跑完可删）。
// 为什么不用 mysql 命令行：应用镜像（node:22-alpine standalone）里没有 mysql 客户端，
// 但 DB 只能从应用容器内网访问（DB_HOST=172.26.146.87），所以用容器里现成的 mysql2 跑。
//
// 执行顺序与 migrations/007_seedream_covers.sql 完全一致：
//   1. 备份 projects 表到容器内 /tmp/projects-before-007.json（调用方负责 docker cp 出来）
//   2. 只改仍指向旧 SVG 的 5 个作品：cover.url → cover.jpg，alt/尺寸同步
//   3. 校验：打印 5 个 slug 的最终 url（不含任何密钥）
// 回退：把备份 JSON 里的旧 cover 值写回即可，或执行 007 SQL 文件头的回退 UPDATE。
//
// 干跑模式：DRY_RUN=1 时只 SELECT 当前值并打印「计划变更」，不备份、不写任何数据。

const mysql = require("mysql2/promise")

const SLUGS = ["cv-workshop", "clip-sketch", "openmontage", "exprtrain", "whiteboard-video"]
const DRY = process.env.DRY_RUN === "1"

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
  })

  if (DRY) {
    const [rows] = await conn.query(
      `SELECT slug, JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) AS url FROM projects WHERE slug IN (?,?,?,?,?)`,
      SLUGS
    )
    console.log("[干跑] 以下是将要发生的变更（不会写入）：")
    for (const r of rows) {
      const target = `/images/demos/${r.slug}/cover.jpg`
      const will = r.url && r.url.includes("cover.svg") ? `${r.url} → ${target}` : "跳过（不是旧 SVG）"
      console.log(`  ${r.slug}: ${will}`)
    }
    await conn.end()
    return
  }

  // 1. 备份整张 projects 表（含旧 cover 值）
  const [rows] = await conn.query("SELECT * FROM projects")
  require("fs").writeFileSync("/tmp/projects-before-007.json", JSON.stringify(rows, null, 2))
  console.log(`[备份] projects 表 ${rows.length} 行 → /tmp/projects-before-007.json`)

  // 2. 逐个更新（参数化，与 007 SQL 同条件：只动还指着旧 SVG 的行）
  for (const slug of SLUGS) {
    const [r] = await conn.query(
      `UPDATE projects SET cover = JSON_SET(cover,
         '$.url', ?, '$.alt', ?, '$.width', 2560, '$.height', 1600)
       WHERE slug = ? AND JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.svg'`,
      [`/images/demos/${slug}/cover.jpg`, `AI 生成的功能示意图，非运行截图`, slug]
    )
    console.log(`[更新] ${slug}: 影响 ${r.affectedRows} 行`)
  }

  // 3. 校验
  const [check] = await conn.query(
    `SELECT slug, JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) AS url FROM projects WHERE slug IN (?,?,?,?,?)`,
    SLUGS
  )
  for (const c of check) console.log(`[校验] ${c.slug} → ${c.url}`)

  await conn.end()
}

main().catch((e) => {
  console.error("迁移失败:", e.message)
  process.exit(1)
})
