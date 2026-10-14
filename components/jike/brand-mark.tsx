// 导航栏和页脚站名左边的图形标识（第三版换成用户提供的独角引力图形，原来是渐变方块里的「↗」）。
//
// - 原图 629×437 不是正方形：放进 32×32 的格子里用 object-fit: contain，不拉伸
// - 图形是深色的、背景透明，深色主题下会看不见：.logo-mark 在 .dark 里垫一块小白底（见 jike.css）。
//   以后拿到官方的反白 / 矢量版本，直接换文件即可
// - alt=""：它和旁边的「AI有活」文字一起放在首页链接里，链接名称由文字提供，图片只是装饰；
//   写了 alt 读屏会念两遍
// - 这只是图形替换，站名仍然是 AI有活，不代表平台改名
export function BrandMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- 32px 的小图，next/image 的优化收益抵不过多一层配置 */}
      <img src="/images/brand/dujiao-gravity-logo.png" alt="" width={32} height={22} />
    </span>
  )
}
