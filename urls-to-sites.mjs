import fs from 'fs'
import { datetime, pause } from './lib/util.mjs'
import { TYPE, parseURL, getChannel, getUser } from './lib/yt.mjs'

function writeToJSONFile(val, fileName) {
  fs.writeFile(fileName, JSON.stringify(val), err => {
    if(err) {
      console.error(err)
    }
  })
}

const GET_CHANNEL = true
const GET_USER = true

async function list(urls) {
  const date = new Date()
  const datetimeStr = datetime(date, '-')
  const part = 'id,snippet,statistics,contentDetails'
  let channels = []
  let users = []
  for(let url of urls) {
    console.log(url)
    let { type, id } = parseURL(url)
    if(type === TYPE.channel && GET_CHANNEL) {
      let channel = await getChannel(id, part)
      if(channel) {
        channels.push({
          name: channel.snippet.title,
          url: url
        })
      }
      await pause()
    } else if(type === TYPE.user && GET_USER) {
      let user = await getUser(id, part)
      if(user) {
        users.push({
          name: user.snippet.title,
          url
        })
      }
      await pause()
    }
  }
  for(let channel of channels) {
    console.log(channel.name + '\t' + channel.url)
  }
  for(let user of users) {
    console.log(user.name + '\t' + user.url)
  }
}

const urls = fs.readFileSync('data/urls.txt', 'utf8').split('\n').filter(line => line != '')
list(urls)
