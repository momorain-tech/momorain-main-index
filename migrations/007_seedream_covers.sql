-- 迁移 007: 5 个作品的过渡封面从自制 SVG 换成豆包 Seedream 5.0 生成图（.jpg）
-- 设计依据: 用户 2026-10-14 反馈 SVG 封面「背景太黑、看不清、无吸引力」，改用 AI 生成
--
-- 执行前先备份（必须带 utf8mb4）:
--   mysqldump ... --default-character-set=utf8mb4 momorain projects > /root/db-backups/projects-before-007.sql
-- 执行:
--   mysql ... --default-character-set=utf8mb4 momorain < migrations/007_seedream_covers.sql
--
-- 顺序：**先部署代码（public/images/demos/<slug>/cover.jpg 就位），再跑这个迁移**
-- 反过来的话，新库值指向还没上传的 jpg，封面会短暂 404。首页是 ISR，跑完最多 5 分钟生效。
--
-- 为什么这样写：
-- · 只改还指着旧 SVG 的行（url LIKE '%/images/demos/%/cover.svg'）：后台已经换过真实截图的绝不覆盖
-- · kind 保持 "illustration"：AI 生成图不是运行截图，卡片继续标「功能示意」，也不能当精选
-- · talk-to-fengge 不在名单里：和 006 一样的规矩，真人声音克隆的对外曝光范围没确认之前，
--   不新增素材。图片文件已经生成好（public/images/demos/talk-to-fengge/cover.jpg），
--   确认授权后跑文件末尾那条 UPDATE 即可
--
-- 回退：把 url 换回 .svg（旧 SVG 文件仍保留在 public/）:
--   UPDATE projects SET cover = JSON_SET(cover, '$.url', REPLACE(JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')), '.jpg', '.svg'))
--   WHERE JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.jpg';

UPDATE projects SET cover = JSON_SET(cover,
  '$.url', '/images/demos/cv-workshop/cover.jpg',
  '$.alt', '简历工坊的功能示意图，AI 生成，非运行截图',
  '$.width', 2560, '$.height', 1600)
WHERE slug = 'cv-workshop'
  AND JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.svg';

UPDATE projects SET cover = JSON_SET(cover,
  '$.url', '/images/demos/clip-sketch/cover.jpg',
  '$.alt', '视频转手绘的功能示意图，AI 生成，非运行截图',
  '$.width', 2560, '$.height', 1600)
WHERE slug = 'clip-sketch'
  AND JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.svg';

UPDATE projects SET cover = JSON_SET(cover,
  '$.url', '/images/demos/openmontage/cover.jpg',
  '$.alt', 'AI 视频工坊的功能示意图，AI 生成，非运行截图',
  '$.width', 2560, '$.height', 1600)
WHERE slug = 'openmontage'
  AND JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.svg';

UPDATE projects SET cover = JSON_SET(cover,
  '$.url', '/images/demos/exprtrain/cover.jpg',
  '$.alt', '表达训练的功能示意图，AI 生成，非运行截图',
  '$.width', 2560, '$.height', 1600)
WHERE slug = 'exprtrain'
  AND JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.svg';

UPDATE projects SET cover = JSON_SET(cover,
  '$.url', '/images/demos/whiteboard-video/cover.jpg',
  '$.alt', '白板视频的功能示意图，AI 生成，非运行截图',
  '$.width', 2560, '$.height', 1600)
WHERE slug = 'whiteboard-video'
  AND JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.svg';

-- ── 峰哥：授权确认后取消注释执行 ─────────────────────────────────────────
-- UPDATE projects SET cover = JSON_OBJECT(
--   'url', '/images/demos/talk-to-fengge/cover.jpg',
--   'alt', 'Talk to 峰哥的功能示意图，AI 生成，非运行截图',
--   'width', 2560, 'height', 1600, 'kind', 'illustration')
-- WHERE slug = 'talk-to-fengge' AND cover IS NULL;
