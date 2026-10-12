// 联系方式的唯一配置（§7.1）。导航、首页、项目详情、页脚的咨询入口全部从这里读，
// 换人、换二维码只改这一个文件。
//
// ⚠️ 下面的微信号和二维码是从旧页脚原样搬过来的，**还没有经过本次复核**：
// 上线前请业务负责人确认它对应的是实际负责商务咨询的人，确认后把 confirmed 改成 true。
// （confirmed 目前只是一个提醒标记，不影响页面显示）
export const contactConfig = {
  confirmed: false,
  // 联系人称呼。留空时页面显示「商务合作」，不编造人名
  contactName: "",
  wechatId: "instusehub_com",
  // public/ 下的静态文件。二维码加载失败时，面板上始终还有微信号可以复制
  wechatQr: "/wechat-qr.jpg",
  // 面板底部的补充说明（比如回复时间）。没有确定的安排就别写
  note: "添加时备注来意，会更快通过。",
}

export type ContactConfig = typeof contactConfig
