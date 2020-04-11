import { YT } from '../config.mjs'
import axios from 'axios'
const youtube = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3'
})

export const TYPE = {
  channel: 'youtube_channel',
  user: 'youtube_user'
}

export function parseURL(url) {
  let result = null
  let re = /\/(channel|user)\/([^/]+)/i
  let match = url.match(re)
  if(match) {
    let type = 'youtube_' + match[1]
    let id = match[2]
    result = {
      type,
      id
    }
  }
  return result
}

export function getVideoID(url) {
  let [, id] = url.split('=') // FIXME: bad implementation
  return id
}

export function getVideoURL(id) {
  return 'https://www.youtube.com/watch?v=' + id
}

const thumbnailResKeys = ['maxres', 'standard', 'high', 'medium', 'default']
export function getThumbnailURL(dict) {
  let url = null
  for(let key of thumbnailResKeys) {
    if(dict[key]) {
      url = dict[key].url
      break
    }
  }
  return url
}

const ERROR = {
  dailyLimitExceeded: 'dailyLimitExceeded'
}

function handleError(e) {
  let exit = false
  let { code, message, errors } = e.response.data.error
  let error = errors[0]
  console.error('YouTube API error', code)
  console.error(error)
  if(error.reason === ERROR.dailyLimitExceeded) {
    exit = true
  }
  // TODO: other reasons
  if(exit) {
    // TODO: do something maybe?
  }
}

export async function getChannel(id, part = 'id') {
  let data, status, channel = null
  try {
    ({ data, status } = await youtube.get('/channels', {
      params: {
        id,
        part,
        key: YT.key
      }
    }))
  } catch(e) {
    handleError(e)
  }
  if(data && data.pageInfo && data.pageInfo.totalResults > 0) {
    channel = data.items[0]
  }
  return channel
}

export async function getUser(userName, part = 'id') {
  let data, status, channel = null
  try {
    ({ data, status } = await youtube.get('/channels', {
      params: {
        forUsername: userName,
        part,
        key: YT.key
      }
    }))
  } catch(e) {
    handleError(e)
  }
  if(data && data.pageInfo && data.pageInfo.totalResults > 0) {
    channel = data.items[0]
  }
  return channel
}

export async function getPlaylistItems(id, pageToken = null, part = 'id') {
  let data, status = null
  try {
    ({ data, status } = await youtube.get('/playlistItems', {
      params: {
        playlistId: id,
        ...(pageToken ? { pageToken } : {}),
        part,
        key: YT.key,
        maxResults: 50
      }
    }))
  } catch(e) {
    handleError(e)
  }
  let nextPageToken = undefined
  let totalCount = 0
  let items = []
  if(data && data.pageInfo && data.pageInfo.totalResults > 0) {
    nextPageToken = data.nextPageToken
    totalCount = data.pageInfo.totalResults
    item = data.items
  }
  return {
    nextPageToken,
    totalCount,
    items
  }
}

export async function getVideo(id, part = 'id') {
  let data, status, video = null
  try {
    ({ data, status } = await youtube.get('/videos', {
      params: {
        id,
        part,
        key: YT.key
      }
    }))
  } catch(e) {
    handleError(e)
  }
  if(data && data.pageInfo && data.pageInfo.totalResults > 0) {
    video = data.items[0]
  }
  return video
}
