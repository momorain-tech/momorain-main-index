-- 迁移 001: 创建 projects 表并导入初始数据
-- 数据库: momorain
-- 执行方式: mysql -h 127.0.0.1 -u momorain_app -p momorain < migrations/001_projects.sql

CREATE TABLE IF NOT EXISTS projects (
  slug        VARCHAR(100)                             NOT NULL,
  icon        VARCHAR(20)                              NOT NULL,
  name        VARCHAR(100)                             NOT NULL,
  desc_short  VARCHAR(500)                             NOT NULL,
  long_desc   TEXT                                     NOT NULL,
  tags        JSON                                     NOT NULL,
  link        VARCHAR(500)                             DEFAULT NULL,
  demo        VARCHAR(500)                             DEFAULT NULL,
  category    ENUM('recommended','trending','starred') NOT NULL,
  sort_order  TINYINT UNSIGNED                         NOT NULL DEFAULT 0,
  created_at  TIMESTAMP                                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP                                NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 推荐项目 ─────────────────────────────────────────────────────
INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('rainflow', '🌊', 'RainFlow',
 '轻量级数据流状态管理库，零依赖，支持 SSR',
 'RainFlow 是一个极简的 React 状态管理库，核心代码不足 200 行，零运行时依赖。它借鉴了 Zustand 的 API 设计，并针对 Next.js SSR 场景做了专门优化，确保服务端和客户端状态完全一致，彻底消除 hydration 警告。',
 '["React","状态管理","SSR","TypeScript"]',
 'https://demo.rainflow.momorain.tech',
 'recommended', 0);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('palettekit', '🎨', 'PaletteKit',
 '可视化主题生成工具，一键导出 Tailwind 配置',
 'PaletteKit 提供一个直观的调色盘界面，让你通过拖拽和色轮选取品牌色，系统会自动生成符合 WCAG 对比度标准的完整色阶，并一键导出为 tailwind.config.ts、CSS 变量或 shadcn/ui 主题格式。',
 '["Tailwind CSS","设计工具","可访问性"]',
 'https://demo.palettekit.momorain.tech',
 'recommended', 1);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('searchx', '🔍', 'SearchX',
 '全文检索组件，支持中文分词与模糊匹配',
 'SearchX 是一个开箱即用的前端搜索组件，内置基于 TF-IDF 的相关度排序和结果高亮。中文分词基于结巴分词的 WASM 版本，无需后端接口，所有计算在浏览器内完成，适合文档站、博客等静态场景。',
 '["搜索","中文","WASM","无后端"]',
 'https://demo.searchx.momorain.tech',
 'recommended', 2);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('boxui', '📦', 'BoxUI',
 '企业级 React 组件库，覆盖 50+ 常用场景',
 'BoxUI 基于 Radix UI 原语封装，提供 50+ 无障碍、可主题化的业务组件，覆盖表单、表格、模态框、数据展示等常见场景。完整支持 TypeScript，组件 API 经过真实项目打磨，文档包含可交互的 Storybook 示例。',
 '["组件库","Radix UI","无障碍","企业级"]',
 'https://demo.boxui.momorain.tech',
 'recommended', 3);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('fastroute', '⚡', 'FastRoute',
 '基于 Radix Tree 的高性能 Next.js 路由增强',
 'FastRoute 在 Next.js App Router 之上提供额外的路由能力：基于 Radix Tree 的参数匹配比内置方案快 3 倍、支持路由级别的权限守卫、内置路由分析面板实时展示各页面加载耗时，帮助快速定位性能瓶颈。',
 '["Next.js","路由","性能","权限"]',
 'https://demo.fastroute.momorain.tech',
 'recommended', 4);

-- ─── 当前最热 ─────────────────────────────────────────────────────
INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('launchpad', '🚀', 'LaunchPad',
 '一键部署工具，支持 Vercel / Railway / 自建服务器',
 'LaunchPad 统一封装了主流托管平台的部署 API，通过一个配置文件 launch.yaml 描述你的应用，即可在 Vercel、Railway、Render 或自建 VPS 之间无缝切换，告别平台锁定。',
 '["DevOps","部署","CI/CD"]',
 'https://demo.launchpad.momorain.tech',
 'trending', 0);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('aiwidget', '🤖', 'AiWidget',
 '嵌入式 AI 对话组件，接入任意 LLM 后端',
 'AiWidget 是一个可嵌入任意网页的浮动 AI 对话组件，支持流式输出和 Markdown 渲染。后端适配器覆盖 OpenAI、Anthropic Claude、本地 Ollama 等主流接口，切换模型只需改一行配置。',
 '["AI","LLM","组件","流式输出"]',
 'https://demo.aiwidget.momorain.tech',
 'trending', 1);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('chartrain', '📊', 'ChartRain',
 '响应式数据可视化库，基于 Canvas 高性能渲染',
 'ChartRain 使用 Canvas 2D 而非 SVG 渲染图表，在 10 万数据点场景下仍保持 60fps 流畅交互。内置折线图、柱状图、散点图、热力图等 12 种图表类型，支持暗色主题与自适应布局。',
 '["可视化","Canvas","性能","图表"]',
 'https://demo.chartrain.momorain.tech',
 'trending', 2);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('authkit', '🔐', 'AuthKit',
 '开箱即用的鉴权方案，支持 OAuth2 / Passkey',
 'AuthKit 为 Next.js 应用提供完整的鉴权解决方案：支持 GitHub、Google OAuth2、Magic Link 邮件登录，以及最新的 Passkey 无密码认证。基于 JWT + HttpOnly Cookie，内置 CSRF 防护。',
 '["鉴权","OAuth2","Passkey","安全"]',
 'https://demo.authkit.momorain.tech',
 'trending', 3);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('i18nflow', '🌐', 'I18nFlow',
 '自动化国际化工作流，AI 辅助翻译 + 类型安全',
 'I18nFlow 通过 CLI 扫描代码库，自动提取所有需要翻译的字符串，调用 LLM 完成初步翻译，并生成完整的 TypeScript 类型定义，让 t(''key'') 调用在编译期即可发现拼写错误和缺失翻译。',
 '["i18n","AI","TypeScript","自动化"]',
 'https://demo.i18nflow.momorain.tech',
 'trending', 4);

-- ─── 用户收藏 ─────────────────────────────────────────────────────
INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, link, demo, category, sort_order) VALUES
('solyricist', '🎵', 'SoLyricist',
 'AI 辅助填词平台，已服务 10,000+ 创作者',
 'SoLyricist 是 momorain-tech 旗下的旗舰产品，提供音节分析、韵脚推荐、意象联想等 AI 辅助填词功能。已积累超过 10,000 名创作者用户，生成词作 50 万首以上。',
 '["AI","音乐","创作","SaaS"]',
 'https://solyricist.com',
 'https://solyricist.com',
 'starred', 0);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('imagegen', '🖼️', 'ImageGen',
 '图像生成服务封装，统一调度多个 AI 绘图接口',
 'ImageGen 作为 AI 绘图接口的聚合层，统一封装了 Stable Diffusion、DALL·E、Midjourney 等主流绘图服务。提供队列管理、失败重试、结果缓存和费用统计，大幅降低多模型调度的复杂度。',
 '["AI 绘图","API 聚合","队列"]',
 'https://demo.imagegen.momorain.tech',
 'starred', 1);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('notesync', '📝', 'NoteSync',
 '多端同步笔记应用，端对端加密存储',
 'NoteSync 采用 CRDT 算法实现无冲突的多端实时同步，所有内容在上传前经过 AES-256 端对端加密，服务端无法读取明文。支持 Markdown 编辑、双链笔记和知识图谱可视化。',
 '["笔记","CRDT","端对端加密","知识库"]',
 'https://demo.notesync.momorain.tech',
 'starred', 2);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('filevault', '🗂️', 'FileVault',
 '私有化文件管理系统，支持版本历史与协作',
 'FileVault 是一个可自托管的团队文件管理平台，兼容 S3 协议的对象存储后端（MinIO、Cloudflare R2 等），提供文件版本历史、在线预览（PDF / 图片 / Office）、精细化权限控制和审计日志。',
 '["文件管理","自托管","S3","协作"]',
 'https://demo.filevault.momorain.tech',
 'starred', 3);

INSERT INTO projects (slug, icon, name, desc_short, long_desc, tags, demo, category, sort_order) VALUES
('darkmatter', '🌙', 'DarkMatter',
 '暗色主题设计系统，适配 shadcn/ui 生态',
 'DarkMatter 是一套专为暗色环境设计的 UI 规范与主题包，在 shadcn/ui 的 CSS 变量体系上扩展了 20 个语义化颜色 token，解决了默认暗色模式下对比度不足、色彩疲劳等常见问题。',
 '["设计系统","暗色主题","shadcn/ui"]',
 'https://demo.darkmatter.momorain.tech',
 'starred', 4);
