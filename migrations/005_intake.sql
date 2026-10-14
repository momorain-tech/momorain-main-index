-- 迁移 005: 第三版「资料真实接收」——需求、服务申请、跟进记录、AI 初评任务、上传素材、部署工单
-- 设计依据: docs/MAIN_INDEX_V3_DEVELOPMENT.md §5.1（数据模型）、§6.3（任务）、§7（上传与部署）
--
-- 执行前先备份（必须带 utf8mb4）:
--   mysqldump ... --default-character-set=utf8mb4 momorain projects > /root/db-backups/projects-before-005.sql
-- 执行:
--   mysql ... --default-character-set=utf8mb4 momorain < migrations/005_intake.sql
--
-- 顺序：这次全是**新建表**，不改已有的 projects。所以先部署代码、后跑迁移也不会把首页弄挂——
-- 只是迁移跑之前，两类表单提交会回 503「接收服务不可用」（前端会保留填写内容）。
-- 仍然建议先跑迁移再部署，避免有人恰好在这几分钟里提交。
-- 全部用 CREATE TABLE IF NOT EXISTS，重复执行无副作用。
--
-- 回退：不要删这些表——里面是用户提交的资料。回退镜像即可，旧代码看不见这些表。
--
-- ─── 为什么这样设计 ───────────────────────────────────────────────
-- · 主键是服务端生成的随机串（rq_xxxx / pa_xxxx），不用自增 id：
--   自增 id 可以被逐个猜（/my/requests/1、2、3…）。但**权限仍按 owner_id 检查**，
--   随机 id 只是第二道保险，不是访问控制。
-- · owner_id 就是 user-login 的 userId（session JWT 里的那个），只存不建外键——
--   user 表归认证服务管，主站不往它身上挂约束（同 PLATFORM.md「各管各的表」）。
-- · (owner_id, request_key) 唯一：request_key 是浏览器为「这一次填写」生成的幂等键。
--   网络超时后重试、手抖连点两下，都只会落一条记录；payload_hash 用来区分
--   「同一个键、同样内容 = 重放，返回原记录」和「同一个键、内容变了 = 409」。
-- · 资料正文放 JSON 列（payload_json / profile_json / works_json）：表单字段会随运营调整，
--   不值得每改一个字段就 ALTER TABLE。要按条件筛选的（状态、负责人、时间）才单独成列。
-- · version 是乐观锁：两个管理员同时改一条记录，后保存的那个会收到 409，而不是悄悄覆盖。
-- · 联系方式只在这些私密表里，公开作品走 projects 表，由管理员审核后另行录入——
--   永远不把整份申请 JSON 直接序列化到公开页面。

-- 需求方提交的需求
CREATE TABLE IF NOT EXISTS intake_requests (
  id            VARCHAR(32)  NOT NULL PRIMARY KEY,
  owner_id      VARCHAR(64)  NOT NULL,
  request_key   VARCHAR(64)  NOT NULL,
  payload_hash  CHAR(64)     NOT NULL,
  payload_json  JSON         NOT NULL,
  -- 列表要显示的标题。用户没填需求名称时由服务端从「想解决的问题」截取，不替用户编业务判断
  title         VARCHAR(120) NOT NULL,
  -- received / reviewing / contacting / waiting_customer / closed（取值在 lib/intake/constants.ts）
  status        VARCHAR(24)  NOT NULL DEFAULT 'received',
  assignee_id   VARCHAR(64)  NULL,
  assignee_name VARCHAR(100) NULL,
  -- 给提交者看的「需要你补充什么」，由管理员填写；内部备注写在 intake_events 里，不给提交者看
  customer_note VARCHAR(1000) NULL,
  -- 提交那一刻对 AI 初评的决定：not_requested（没勾选）/ not_enabled（平台没配模型）/
  -- limited（今日名额满）/ queued（已排队）。排队之后的进展看 ai_analysis_jobs，那边的状态优先
  analysis_status VARCHAR(20) NOT NULL DEFAULT 'not_requested',
  version       INT UNSIGNED NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_owner_key (owner_id, request_key),
  KEY idx_owner (owner_id, created_at),
  KEY idx_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 服务方提交的资料与作品（入驻申请）。审核通过也不会自动进 projects 表
CREATE TABLE IF NOT EXISTS provider_applications (
  id             VARCHAR(32)  NOT NULL PRIMARY KEY,
  owner_id       VARCHAR(64)  NOT NULL,
  request_key    VARCHAR(64)  NOT NULL,
  payload_hash   CHAR(64)     NOT NULL,
  profile_json   JSON         NOT NULL,
  works_json     JSON         NOT NULL,
  display_name   VARCHAR(100) NOT NULL,
  -- pending_review / needs_info / ready_to_publish / published / declined
  review_status  VARCHAR(24)  NOT NULL DEFAULT 'pending_review',
  public_scope   JSON         NOT NULL,
  consent_version VARCHAR(20) NOT NULL,
  assignee_id    VARCHAR(64)  NULL,
  assignee_name  VARCHAR(100) NULL,
  customer_note  VARCHAR(1000) NULL,
  version        INT UNSIGNED NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_owner_key (owner_id, request_key),
  KEY idx_owner (owner_id, created_at),
  KEY idx_status (review_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 操作记录：接收、指派、改状态、内部备注、补充说明、部署工单变化……只增不改
CREATE TABLE IF NOT EXISTS intake_events (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type  VARCHAR(20)  NOT NULL,  -- request / application
  entity_id    VARCHAR(32)  NOT NULL,
  actor_id     VARCHAR(64)  NULL,      -- NULL = 系统（如 AI 任务）
  actor_name   VARCHAR(100) NULL,
  event_type   VARCHAR(32)  NOT NULL,  -- received / status / assign / note / customer_note / analysis / deployment
  note         TEXT         NULL,
  version      INT UNSIGNED NOT NULL,  -- 发生时记录所处的 version
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entity (entity_type, entity_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 初评任务。worker 用「条件 UPDATE + 租约」领取，多个副本不会同时处理同一条
CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id      VARCHAR(32)  NOT NULL,
  request_version INT UNSIGNED NOT NULL,
  prompt_version  VARCHAR(20)  NOT NULL,
  -- queued / running / succeeded / failed / needs_review / stale
  status          VARCHAR(20)  NOT NULL DEFAULT 'queued',
  lease_until     DATETIME     NULL,
  attempt         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  model           VARCHAR(100) NULL,
  result_json     JSON         NULL,
  error_code      VARCHAR(40)  NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 同一需求版本 + 同一提示词版本只分析一次：重复入队直接被唯一键挡掉
  UNIQUE KEY uk_dedupe (request_id, request_version, prompt_version),
  KEY idx_pick (status, lease_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户上传的素材（截图、录屏、静态 Demo 包）。文件本体在持久卷上，表里只有元数据
CREATE TABLE IF NOT EXISTS media_assets (
  id            VARCHAR(32)  NOT NULL PRIMARY KEY,
  owner_id      VARCHAR(64)  NOT NULL,
  -- 服务端生成的相对路径，不含用户文件名：intake/{ownerId}/{assetId}/original
  object_key    VARCHAR(255) NOT NULL,
  type          VARCHAR(10)  NOT NULL,  -- image / video / zip
  mime          VARCHAR(50)  NOT NULL,
  size          BIGINT UNSIGNED NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  -- 用户原来的文件名，只用于展示（已截断、去掉路径），绝不参与拼路径
  original_name VARCHAR(200) NOT NULL,
  -- 上传时的自动检查结果：passed / rejected（rejected 的根本不会入库，留作以后异步扫描用）
  scan_status   VARCHAR(20)  NOT NULL DEFAULT 'passed',
  -- pending / approved / rejected：人工审核
  review_status VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- private：只有本人和管理员能读。目前没有任何公开读取路径
  visibility    VARCHAR(20)  NOT NULL DEFAULT 'private',
  -- 被哪份申请引用（提交申请时回填）。NULL = 上传了但还没提交，按留存策略清理
  application_id VARCHAR(32) NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_owner (owner_id, created_at),
  KEY idx_application (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Demo 部署工单：上传成功 ≠ 部署成功。只有 status = deployed 且填了验证过的地址，
-- 申请人那边才会显示「打开 Demo」
CREATE TABLE IF NOT EXISTS demo_deployments (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  application_id   VARCHAR(32)  NOT NULL,
  work_index       TINYINT UNSIGNED NOT NULL,
  package_asset_id VARCHAR(32)  NULL,
  -- pending_review / queued / building / deployed / failed / paused
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending_review',
  public_url       VARCHAR(500) NULL,
  failure_summary  VARCHAR(500) NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_work (application_id, work_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
