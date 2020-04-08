export const pause = (time = 500) => new Promise(resolve => setTimeout(resolve, time))

export function datetime(date, separator) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  let str =  [y, (m < 10 ? '0' : '') + m, (d < 10 ? '0' : '') + d].join('-') + ' ' + date.toLocaleTimeString('zh-Hant-TW', { hour12: false })
  if(separator) {
    str = str.replace(/[-:\s]/g, separator)
  }
  return str
}
