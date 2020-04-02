import axios from 'axios'
import { pause, datetime } from './lib/util.mjs'
import { TYPE, parseURL, getChannel, getUser } from './lib/yt.mjs'
import { YT, MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

const youtube = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3'
})

async function updateSite(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = date.getTime()
  console.log(datetimeStr, 'Update site', site.site_id, site.url)
  let { id } = parseURL(site.url)
  if(!id) {
    console.error(datetimeStr, 'Not a valid YouTube url:', site.url)
    return null
  }
  let channel, snapshot
  try {
    if(site.type === TYPE.channel) {
      channel = await getChannel(id, 'id,snippet,statistics,contentDetails')
    } else if(site.type === TYPE.user) {
      channel = await getUser(id, 'id,snippet,statistics,contentDetails')
    }
  } catch(err) {
    if(err) {
      console.error(datetimeStr, 'Cannot get:', site.type, id)
      console.error(err)
    }
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
    console.error(datetimeStr, 'No data:', site.type, id)
  }
  return snapshot
}

async function discoverSite(snapshot, pool) {
  let playlistID = snapshot.uploads_playlist_id
  console.log(playlistID)
}

async function discover() {
  const pool = await mysql.createPool(MYSQL)
  let [rows, fields] = await pool.query('SELECT * FROM Site')
  let sites = rows
  let snapshots = []
  for(let site of sites) {
    let snapshot = await updateSite(site, pool)
    snapshots.push(snapshot)
    await pause()
  }
  // TODO: discover site
  await pool.end()
}

discover()
