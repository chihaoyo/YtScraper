import inquirer from 'inquirer'

export const pause = (time = 250) => new Promise(resolve => setTimeout(resolve, time))

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

export const ANSWERS = {
  yes: 'yes',
  stopAsking: 'stopAsking',
  skip: 'skip',
  abort: 'abort',
}
export async function prompt() {
  let res = await inquirer.prompt([
    {
      type: 'list',
      name: 'input',
      message: 'Go?',
      choices: [
        {
          name: 'Yes.',
          value: ANSWERS.yes
        },
        {
          name: 'Stop asking.',
          value: ANSWERS.stopAsking
        },
        {
          name: 'Skip this site.',
          value: ANSWERS.skip
        },
        {
          name: 'Abort.',
          value: ANSWERS.abort
        }
      ]
    }
  ])
  return res.input
}
