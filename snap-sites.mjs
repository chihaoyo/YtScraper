import { pause, datetime } from './lib/util.mjs'
import * as youtube from './lib/yt.mjs'
import { YT, MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

async function snapSite(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = Math.floor(date.getTime() / 1000)
  console.log(datetimeStr, 'update site', site.site_id, site.url)
  let { id } = youtube.parseURL(site.url)
  if(!id) {
    console.error(datetimeStr, 'not a valid YouTube url', site.url)
    return null
  }
  const part = 'id,snippet,statistics,contentDetails'
  let channel, snapshot
  if(site.type === youtube.TYPE.channel) {
    channel = await youtube.getChannel(id, part)
  } else if(site.type === youtube.TYPE.user) {
    channel = await youtube.getUser(id, part)
  }
  if(channel) {
    snapshot = {
      site_id: site.site_id,
      snapshot_at: timestamp,
      raw_data: JSON.stringify(channel)
    }
    if(channel.snippet) {
      Object.assign(snapshot, {
        title: channel.snippet.title,
        description: channel.snippet.description,
        custom_url: channel.snippet.customUrl,
        published_at: Math.floor((new Date(channel.snippet.publishedAt)).getTime() / 1000),
        thumbnail_url: youtube.getThumbnailURL(channel.snippet.thumbnails),
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
    date = new Date()
    datetimeStr = datetime(date)
    timestamp = Math.floor(date.getTime() / 1000)
    let [insRes] = await pool.query('INSERT INTO SiteSnapshot SET ?', snapshot)
    let siteInfo = {
      playlistID: snapshot.uploads_playlist_id
    }
    let [updRes] = await pool.query('UPDATE Site SET site_info = ? WHERE site_id = ?', [JSON.stringify(siteInfo), site.site_id])
    console.log(datetimeStr, insRes, updRes)
  } else {
    console.error(datetimeStr, 'no data', site.type, id)
  }
  return snapshot
}

async function snap(siteID) {
  const pool = await mysql.createPool(MYSQL)

  console.log(datetime(), 'snap site')
  let snapshots = []
  let [rows] = await pool.query('SELECT * FROM Site')
  let sites = siteID ? rows.filter(row => row.site_id === siteID) : rows
  for(let site of sites) {
    await snapSite(site, pool)
    await pause()
  }
  await pool.end()
}

let args = process.argv.slice(2)
let siteID = null
if(args.length > 0) {
  siteID = +args[0]
}
snap(siteID)
