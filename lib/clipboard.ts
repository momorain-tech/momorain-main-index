// 复制到剪贴板，两级降级（咨询卡片和资料整理表单共用）：
// 1. navigator.clipboard：现代浏览器，但要求 HTTPS + 页面有焦点，部分内置浏览器直接禁用
// 2. 隐藏 textarea + execCommand("copy")：老办法，已被标记废弃但兼容性最好
// 都不行就返回 false，由调用方把文字摆出来让用户手动复制。
//
// 为什么 textarea 要挂在 container 里而不是 document.body：
// 原生 <dialog> 打开时处在浏览器的「顶层」，挂在 body 上的元素在它下面，选不中
export async function copyText(text: string, container: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续走降级方案
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    ;(container ?? document.body).appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}
