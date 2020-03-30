import { YT } from '../config.mjs'
import axios from 'axios'
const youtube = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3'
})

export function parseURL(url) {
  let result = null
  let re = /\/(channel|user)\/([^/]+)/i
  let match = url.match(re)
  if(match) {
    let type = match[1]
    let id = match[2]
    result = {
      type,
      id
    }
  }
  return result
}

export async function getChannel(id, part = 'id') {
  let { data, status } = await youtube.get('/channels', {
    params: {
      id,
      part,
      key: YT.key
    }
  })
  let channel = null
  if(data.pageInfo && data.pageInfo.totalResults > 0) {
    channel = data.items[0]
  }
  return channel
}

export async function getUser(userName, part = 'id') {
  let { data, status } = await youtube.get('/channels', {
    params: {
      forUsername: userName,
      part,
      key: YT.key
    }
  })
  let channel = null
  console.log(data)
  if(data.pageInfo && data.pageInfo.totalResults > 0) {
    channel = data.items[0]
  }
  console.log(channel)
  return channel
}
