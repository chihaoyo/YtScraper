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
  let { data, status } = await youtube.get('/channels', {
    params: {
      key: YT.key,
      part: 'id,snippet,statistics',
      id
    }
  })
  if(data.pageInfo && data.pageInfo.totalResults > 0) {
    let channel = data.items[0]
    if(channel.snippet && channel.statistics) {
      let published_at = (new Date(channel.snippet.publishedAt)).getTime()
      let val = {
        site_id: site.site_id,
        snapshot_at: timestamp / 1000,
        raw_data: JSON.stringify(channel),
        title: channel.snippet.title,
        description: channel.snippet.description,
        custom_url: channel.snippet.customUrl,
        published_at: published_at / 1000,
        thumbnail_url: channel.snippet.thumbnails.high.url,
        view_count: +channel.statistics.viewCount,
        comment_count: +channel.statistics.commentCount,
        subscriber_count: +channel.statistics.subscriberCount,
        video_count: +channel.statistics.videoCount
      }
      let sql = mysql.format('INSERT INTO SiteSnapshot SET ?', val)
      let [res] = await pool.query(sql)
      console.log(datetimeStr, res)
    } else {
      console.error(datetimeStr, 'Not a valid channel object:', channel)
    }
  }
  return data
}

let channels = []
async function discover() {
  const pool = await mysql.createPool(MYSQL)
  let [rows, fields] = await pool.query('SELECT * FROM Site')
  let sites = rows
  for(let site of sites) {
    if(site.type === TYPE_CHANNEL) {
      let data = await discoverOne(site, pool)
      await pause(1000)
    }
  }
  await pool.end()
}

discover()
