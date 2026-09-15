-- 迁移 003: 用 momorain-tech 组织里真实上线的项目，替换 001 导入的示例数据
-- 数据库: momorain
--
-- 执行前先备份 projects 表（被删的行里有 rainflow 的 wiki，可能还有别人在后台改过的内容）:
--   mysqldump ... --default-character-set=utf8mb4 momorain projects > projects-before-003.sql
-- 执行（必须带 utf8mb4，否则中文和 emoji 会双重编码成乱码，2026-07-06 踩过）:
--   mysql ... --default-character-set=utf8mb4 momorain < migrations/003_real_projects.sql
--
-- 为什么整段包在事务里：先删后插，中间任何一条失败（比如重复执行撞上主键），
-- mysql 客户端会退出，没提交的事务自动回滚——不会出现"旧的删了、新的没进去"的空首页。
-- 所以这个文件重复执行是安全的：第二次会在 INSERT 处报 Duplicate entry，什么都不改。
--
-- 收录标准：组织仓库里有公开可访问网页的产品。没收录的：
--   momorain-main-index（本站）、user-login（登录后端）、one-api（模型网关，入口已并入 /account）、
--   rendercv（引擎 CLI，网页版就是 cv-workshop）、Supervision_YOLOv8（没有公开地址）
--
-- link 一律留空：这些仓库大多是私有的，放 GitHub 链接访客点进去是 404；
-- 详情页只在 link 和 demo 不同时才显示「访问项目主页」按钮，留空就只剩 Demo 按钮。

START TRANSACTION;

-- ─── 删掉示例数据 ─────────────────────────────────────────────────
-- 用明确的 slug 清单，不用 DELETE FROM projects：万一有人在后台加过真项目，不会被一起删掉
DELETE FROM projects WHERE slug IN (
  -- 001 导入的 15 条示例
  'rainflow', 'palettekit', 'searchx', 'boxui', 'fastroute',
  'launchpad', 'aiwidget', 'chartrain', 'authkit', 'i18nflow',
  'solyricist', 'imagegen', 'notesync', 'filevault', 'darkmatter',
  -- 2026-07-08 管理后台上线时的测试条目（链到站外的 hardhacker.com，不是我们的项目）
  'my-tool-zlg'
);

-- ─── 猜你喜欢：打磨最完整、接了统一登录的两个工具 ─────────────────
INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order, wiki) VALUES
('cv-workshop', '📄', '简历工坊',
 '在线写简历：左边编辑，右边实时预览，一键导出 PDF',
 '简历工坊是 RenderCV 简历引擎的网页版。左边用 YAML 或表单填写经历，右边按页实时预览排版效果，满意后导出 PDF。默认使用带证件照的中文主题，内置中文字体，不用自己装任何东西。可以同时保存多份简历，数据存在你自己的浏览器里；编辑和预览无需登录，下载 PDF 时才需要手机号登录。',
 '["简历","PDF","RenderCV","在线工具"]',
 'https://momorain.com/cv-workshop',
 'recommended', 0,
 '仓库 momorain-tech/rendercv-web（Next.js 前端 + FastAPI 渲染后端），引擎是 fork 仓库 momorain-tech/rendercv，以 git subtree 放在 vendor/。\nDokploy 部署，push main 自动上线。架构和部署细节见仓库本地 CLAUDE.md。'),

('clip-sketch', '✏️', '视频转手绘',
 '把短视频变成手绘分步教程图，顺带写好社媒文案和封面',
 'ClipSketch AI 把一段短视频（或一组图片）拆成关键步骤，生成手绘风格的分步教程图，同时产出适合发小红书等平台的文案和封面。所有项目数据都保存在浏览器本地，不上传服务器。默认使用 momorain 托管的模型，登录后即可生成；也可以填自己的 API Key。',
 '["AI","视频","手绘","内容创作"]',
 'https://momorain.com/clip-sketch/',
 'recommended', 1,
 '仓库 momorain-tech/clipsketch-ai（纯前端 Vite SPA，没有后端，数据在 IndexedDB）。\nDokploy 部署，push main 后 webhook 自动上线。细节见仓库本地 CLAUDE.md。');

-- ─── 当前最热 ─────────────────────────────────────────────────────
INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order, wiki) VALUES
('talk-to-fengge', '🎙️', 'Talk to 峰哥',
 '和 AI 分身实时语音聊天，声音和性格都像本人',
 '像打电话一样和 AI 分身实时对话：语音识别、大模型回复、音色克隆合成串成一条链路，工程延迟压到 1 秒以内。除了声音，说话风格、口头禅和思维方式也做了人格注入。峰哥是这套架构的第一个完整示例，换一份语音素材和人格描述就能换成别人。需要允许浏览器使用麦克风。',
 '["AI","实时语音","音色克隆","LiveKit"]',
 'https://www.momorain.com/talk-to-fengge/',
 'trending', 0,
 '仓库 momorain-tech/talk-to-fengge（LiveKit + Python worker，docker-compose 三个服务：web / worker / livekit）。\n部署说明见仓库根的 DEPLOY.md。只挂在 www.momorain.com 上。'),

('openmontage', '🎬', 'AI 视频工坊',
 '一句话生成手绘解说视频',
 '输入一句话主题，AI 自动写旁白、规划镜头、配音、生成手绘风格插画，最后合成完整的解说视频。开拍前可以先审阅每一段旁白和镜头规划，确认后才开始制作。浏览免登录，「开拍」这一步需要手机号登录。',
 '["AI","视频生成","手绘","Remotion"]',
 'https://www.momorain.com/OpenMontage/',
 'trending', 1,
 '仓库 momorain-tech/OpenMontage（FastAPI 体验壳 + 原生 JS 单页 + Remotion 渲染）。\n部署说明见仓库根的 DEPLOY.md。只挂在 www.momorain.com 上。');

-- ─── 用户收藏 ─────────────────────────────────────────────────────
INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order, wiki) VALUES
('exprtrain', '🗣️', '表达训练',
 '对着麦克风说话，实时找出口头禅和含糊用词，AI 给出改进建议',
 '一个训练口语表达精准度的工具：边说边实时转成字幕，自动标出填充词、犹豫词和笼统的说法并给出更精准的替代，说完生成从逻辑、直接性、用词密度等多个维度的分析报告。在线版基于开源项目 exprtrain（作者 fxy2311-youyou，MIT 协议）改造，语音识别和 AI 分析都放在服务端完成。需要允许浏览器使用麦克风。',
 '["AI","语音识别","口语训练"]',
 'https://www.momorain.com/exprtrain/',
 'starred', 0,
 '仓库 momorain-tech/expression-trainer，在线版在 web/ 目录（Compose Path: web/docker-compose.yaml，路由写在 compose labels 里，Dokploy 的 Domain 页留空）。\n服务端 ASR 在 server/。部署说明见仓库根的 DEPLOY.md。只挂在 www.momorain.com 上。'),

('whiteboard-video', '🖍️', '白板视频',
 '把中文逐字稿做成带配音、字幕的白板手绘动画视频',
 '把一份中文逐字稿自动做成 1920×1080 的白板动画视频：旁白配音、逐句字幕、马克笔手绘动画（带画画的手）、低音量背景音乐一次合成，还能生成 YouTube、小红书、抖音等平台的封面。制作前可以逐段修改旁白、预览镜头规划，确认后才开始出片。',
 '["AI","视频生成","白板动画","TTS"]',
 'https://www.momorain.com/om-demo/',
 'starred', 1,
 '仓库 momorain-tech/whiteboard（server.py + static/index.html 是网页壳，页面标题还叫「OpenMontage 体验壳 Demo」）。\n线上路径是 /om-demo（不是 /whiteboard），路由在 Dokploy 的 Domains 页配置，见仓库根的 DEPLOY_SHELL.md。只挂在 www.momorain.com 上。');

COMMIT;
