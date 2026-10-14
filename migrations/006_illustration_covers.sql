-- 迁移 006: 给 5 个已发布作品配上第三版的过渡封面（功能示意图）
-- 设计依据: docs/MAIN_INDEX_V3_DEVELOPMENT.md §3.4、§8.1、§9.1
--
-- 执行前先备份（必须带 utf8mb4）:
--   mysqldump ... --default-character-set=utf8mb4 momorain projects > /root/db-backups/projects-before-006.sql
-- 执行:
--   mysql ... --default-character-set=utf8mb4 momorain < migrations/006_illustration_covers.sql
--
-- 顺序：**先部署第三版代码，再跑这个迁移**（反过来的话，旧代码不认识 kind 字段，
-- 卡片上不会出现「功能示意」角标，示意图会被当成普通封面展示几分钟）。
-- 首页是 ISR，跑完最多 5 分钟生效，不用重新部署。
--
-- 为什么这样写：
-- · 只填 cover 为空的行（AND cover IS NULL）：谁已经在后台换上了真实截图，这里不覆盖
-- · kind = "illustration"：卡片右上角标「功能示意」，且发布检查不允许它当精选封面
-- · 不碰 case_content.outputs：示意图不是真实成果，不能放进成果列表
-- · talk-to-fengge 不在名单里：真人声音克隆，对外曝光范围没确认之前不给它新增素材
--   （docs/assets/v3/drafts/ 里那张草稿也不放进 public/）
--
-- 回退：UPDATE projects SET cover = NULL WHERE JSON_UNQUOTE(JSON_EXTRACT(cover, '$.kind')) = 'illustration';

UPDATE projects SET cover = JSON_OBJECT(
  'url', '/images/demos/cv-workshop/cover.svg', 'alt', '简历工坊的输入输出功能示意，非运行截图',
  'width', 1440, 'height', 900, 'kind', 'illustration')
WHERE slug = 'cv-workshop' AND cover IS NULL;

UPDATE projects SET cover = JSON_OBJECT(
  'url', '/images/demos/clip-sketch/cover.svg', 'alt', '视频转手绘的输入输出功能示意，非运行截图',
  'width', 1440, 'height', 900, 'kind', 'illustration')
WHERE slug = 'clip-sketch' AND cover IS NULL;

UPDATE projects SET cover = JSON_OBJECT(
  'url', '/images/demos/openmontage/cover.svg', 'alt', 'AI 视频工坊的输入输出功能示意，非运行截图',
  'width', 1440, 'height', 900, 'kind', 'illustration')
WHERE slug = 'openmontage' AND cover IS NULL;

UPDATE projects SET cover = JSON_OBJECT(
  'url', '/images/demos/exprtrain/cover.svg', 'alt', '表达训练的输入输出功能示意，非运行截图',
  'width', 1440, 'height', 900, 'kind', 'illustration')
WHERE slug = 'exprtrain' AND cover IS NULL;

UPDATE projects SET cover = JSON_OBJECT(
  'url', '/images/demos/whiteboard-video/cover.svg', 'alt', '白板视频的输入输出功能示意，非运行截图',
  'width', 1440, 'height', 900, 'kind', 'illustration')
WHERE slug = 'whiteboard-video' AND cover IS NULL;
