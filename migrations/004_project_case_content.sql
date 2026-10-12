-- 迁移 004: projects 表加「归属 / 成熟度 / 发布 / 精选 / 封面 / 案例内容」六列
-- 设计依据: docs/MAIN_INDEX_EVOLUTION_V1.md §8.1（数据模型）、§9.3（兼容发布顺序）
--
-- 执行前先备份（必须带 utf8mb4，否则中文和 emoji 会双重编码成乱码）:
--   mysqldump ... --default-character-set=utf8mb4 momorain projects > /root/db-backups/projects-before-004.sql
-- 执行:
--   mysql ... --default-character-set=utf8mb4 momorain < migrations/004_project_case_content.sql
--
-- 顺序：**先跑这个迁移，再部署 dev 分支的代码**。新代码的查询会读这几列，
-- 没迁移就上新镜像会直接报 Unknown column。反过来没问题——
-- 旧镜像的 SELECT / INSERT 都写了显式列名，多出来的列它看不见，回退镜像不用回退数据库。
--
-- 回退：不要删列（删列会丢掉已经录入的案例内容）。回退镜像即可，新列留着不碍事。
--
-- ─── 为什么这样设计 ───────────────────────────────────────────────
-- ownership / maturity 用 VARCHAR + 应用层枚举，不用 ENUM：
--   加一个取值只改代码（lib/project-content.ts），不用再 ALTER TABLE。
--   允许 NULL = 「还没评估」。迁移不替任何项目猜归属、猜成熟度。
-- published / featured 是两个独立开关：精选必须先发布（应用层校验）。
-- cover / case_content 用 JSON：结构在 lib/project-content.ts 里校验，
--   不接收任意 HTML，前台全部按纯文本渲染。
-- updated_at 001 就有了（ON UPDATE CURRENT_TIMESTAMP），不用再加。

ALTER TABLE projects
  ADD COLUMN ownership    VARCHAR(20) NULL                AFTER sort_order,
  ADD COLUMN maturity     VARCHAR(20) NULL                AFTER ownership,
  ADD COLUMN published    TINYINT(1)  NOT NULL DEFAULT 0  AFTER maturity,
  ADD COLUMN featured     TINYINT(1)  NOT NULL DEFAULT 0  AFTER published,
  ADD COLUMN cover        JSON        NULL                AFTER featured,
  ADD COLUMN case_content JSON        NULL                AFTER cover;

-- 现有项目今天本来就在首页公开着，迁移后保持公开，免得一上线首页变空（§9.3 第 5 条）。
-- 这只是「维持现状」，不代表它们通过了新的发布检查——后台会把缺项一条条列出来，
-- 内容补齐之前，编辑这些项目时只能选择「补齐后保存并发布」或「撤下」。
-- 新建的项目默认 published = 0（未发布），要过发布检查才能公开。
UPDATE projects SET published = 1;
