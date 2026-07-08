-- 迁移 002: projects 表新增 wiki 列
-- 用途: 管理员的内部记录（如何部署、账号在哪、注意事项……），只在 /admin 可见
-- 执行方式（注意必须带 utf8mb4，教训见 workspace 记录）:
--   mysql --default-character-set=utf8mb4 -h 127.0.0.1 -u momorain_app -p momorain < migrations/002_projects_wiki.sql

-- 为什么允许 NULL：MySQL 不允许给 TEXT 列设置字面量默认值，
-- 用 NULL 表示"从未写过 wiki"，代码层读出来时统一转成空字符串
ALTER TABLE projects
  ADD COLUMN wiki TEXT NULL AFTER long_desc;
