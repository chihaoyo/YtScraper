import axios from 'axios'
import { pause, datetime } from './lib/util.mjs'
import { parseURL } from './lib/yt.mjs'
import { YT, MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

const TYPE_CHANNEL = 'channel'
const TYPE_USER = 'user'
const youtube = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3'
})

async function discoverOne(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = date.getTime()
  console.log(datetimeStr, 'Discover site', site.site_id, site.url)
  let { id } = parseURL(site.url)
  if(!id) {
    console.error(datetimeStr, 'Not a valid YouTube id:', id)
    return null
  }
  let data, status, channel, snapshot
  try {
    let res = await youtube.get('/channels', {
      params: {
        key: YT.key,
        part: 'id,snippet,statistics,contentDetails',
        id
      }
    })
    data = res.data
    status = res.status
  } catch(err) {
    if(err) {
      console.error(datetimeStr, 'Cannot get channel:', id)
      console.error(err)
    }
  }
  if(data.pageInfo && data.pageInfo.totalResults > 0) {
    channel = data.items[0]
  }
  if(channel) {
    snapshot = {
      site_id: site.site_id,
      snapshot_at: timestamp / 1000,
      raw_data: JSON.stringify(channel)
    }
    if(channel.snippet) {
      Object.assign(snapshot, {
        title: channel.snippet.title,
        description: channel.snippet.description,
        custom_url: channel.snippet.customUrl,
        published_at: (new Date(channel.snippet.publishedAt)).getTime() / 1000,
        thumbnail_url: channel.snippet.thumbnails.high.url,
      })
    }
    if(channel.statistics) {
      Object.assign(snapshot, {
        view_count: +channel.statistics.viewCount,
        comment_count: +channel.statistics.commentCount,
        subscriber_count: +channel.statistics.subscriberCount,
        video_count: +channel.statistics.videoCount
      })
    }
    if(channel.contentDetails) {
      Object.assign(snapshot, {
        uploads_playlist_id: channel.contentDetails.relatedPlaylists.uploads
      })
    }
    let sql = mysql.format('INSERT INTO SiteSnapshot SET ?', snapshot)
    let [res] = await pool.query(sql)
    console.log(datetimeStr, res)
  } else {
    console.error(datetime, 'No channel data:', id)
  }
}

async function discover() {
  const pool = await mysql.createPool(MYSQL)
  let [rows, fields] = await pool.query('SELECT * FROM Site')
  let sites = rows
  for(let site of sites) {
    if(site.type === TYPE_CHANNEL) {
      await discoverOne(site, pool)
      await pause()
    }
  }
  await pool.end()
}

discover()
