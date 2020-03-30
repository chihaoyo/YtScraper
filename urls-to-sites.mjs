import fs from 'fs'
import { datetime, pause } from './lib/util.mjs'
import { parseURL, getChannel, getUser } from './lib/yt.mjs'

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
    let { type, id } = parseURL(url)
    if(type === 'channel' && GET_CHANNEL) {
      let channel = await getChannel(id, part)
      if(channel) {
        channels.push(channel)
        writeToJSONFile(channels, 'data/channels-' + datetimeStr + '.json') // FIXME: brute force continuous file write
      }
      await pause()
    } else if(type === 'user' && GET_USER) {
      let user = await getUser(id, part)
      if(user) {
        users.push(user)
        writeToJSONFile(users, 'data/users-' + datetimeStr + '.json') // FIXME: brute force continuous file write
      }
      await pause()
    }
  }
  for(let channel of channels) {
    console.log(channel.snippet.title + '\t' + 'https://www.youtube.com/channel/' + channel.id)
  }
  for(let user of users) {
    console.log(user.snippet.title + '\t' + 'https://www.youtube.com/channel/' + user.id)
  }
}

const urls = fs.readFileSync('data/urls.txt', 'utf8').split('\n').filter(line => line != '')
list(urls)
