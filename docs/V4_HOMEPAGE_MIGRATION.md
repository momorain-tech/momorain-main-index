# V4 首页迁移与上线核对清单（2026-10-15）

> ⚠️ 2026-10-19 起已被第四版场景首页取代：`app/(home)/` 暗色首页和 `/old` 备份已删，首页回到 `app/(public)/page.tsx`。
> 下面的封面迁移（007）和 talk-to-fengge 封面补丁仍然有效；首页结构部分只作历史记录。

首页从「即刻体验浅色设计」迁到「沉浸式暗色霓虹」（原 /v4 预览页）。
旧首页备份在 `/old`（app/(public)/old/page.tsx），短期保留。

## 一、部署顺序（必须按序）

1. **部署代码**：本仓库 main 分支。新首页在 `app/(home)/`，`/v4` 会 301 到 `/`，
   `/old` 是旧首页备份。`public/images/demos/<slug>/cover.jpg` 六张 Seedream 封面随代码上线。
2. **跑迁移 007**（封面切换）：
   ```sql
   -- 备份后执行
   mysql ... --default-character-set=utf8mb4 momorain < migrations/007_seedream_covers.sql
   ```
   只改还指向旧 SVG 的 5 个作品；后台已换过真实截图的不会被动。首页 ISR 最多 5 分钟生效。
3. **验证**：
   - `/` 新首页正常、`/#projects` 等锚点可跳、旧锚点 `/#shelf` 能落到 Demo 展示区
   - 5 个作品封面是新 jpg（B站风格）；talk-to-fengge 线上暂无封面（见第四节）
   - `/old` 旧首页可访问；二级页面（/projects、/requests…）仍为浅色清新风格

## 二、上线前业务侧核对（阻塞项）

| 项 | 现状 | 动作 |
|---|---|---|
| 微信号/二维码复核 | `config/contact.ts` 的 `confirmed: false`，微信号 `instusehub_com` 是从旧页脚原样搬来的，未经复核 | 业务负责人确认它对应实际商务负责人后，把 `confirmed` 改成 `true` |
| 公开邮箱（可选） | `contactConfig.email` 为空 | 有公开邮箱就填进去，联系区自动出现邮箱卡；没有就保持空，页面只显示微信 |

## 三、回退方案

- **首页回退**：把 `app/(home)/page.tsx` 与 `app/(public)/old/page.tsx` 互换即可（/old 里是完整的旧首页代码）。
- **封面回退**：
  ```sql
  UPDATE projects SET cover = JSON_SET(cover, '$.url',
    REPLACE(JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')), '.jpg', '.svg'))
  WHERE JSON_UNQUOTE(JSON_EXTRACT(cover, '$.url')) LIKE '%/images/demos/%/cover.jpg';
  ```
  旧 SVG 文件已删（用户确认废弃），执行前先从 git 历史恢复：
  `git checkout 893cde9 -- public/images/demos`（仅恢复目录内 SVG）。

## 四、talk-to-fengge 封面（2026-10-15 授权确认）

授权已确认。封面不走数据库：`lib/projects.ts` 的 `coverWithFallbacks` 在线上库无封面记录时
直接补 `cover.jpg`（kind=illustration，卡片标「功能示意」）。
后台以后录入真实封面（cover 非空）后自动让位。
高曝光限制不变：仍不进首页精选与 AI 初评推荐（config/home.ts 的 highExposureExcludeSlugs）。

## 五、结构变化速览

| 路由 | 变更 |
|---|---|
| `/` | 新首页（暗色霓虹），原 `app/(public)/page.tsx` 已迁走 |
| `/v4` | redirect 到 `/` |
| `/old` | 旧首页备份（浅色设计稿版） |
| 二级页面 | 不变，仍走 (public)/layout 浅色外壳 |

主题策略（用户 2026-10-15 定稿）：首页暗色霓虹、二级页面浅色清新、全站不做明暗切换。
