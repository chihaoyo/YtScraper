export const pause = (time = 1000) => new Promise(resolve => setTimeout(resolve, time))

export function datetime(date) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return [y, (m < 10 ? '0' : '') + m, (d < 10 ? '0' : '') + d].join('-') + ' ' + date.toLocaleTimeString('zh-Hant-TW', { hour12: false })
}
