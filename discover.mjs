import { pause, datetime } from './lib/util.mjs'
import * as youtube from './lib/yt.mjs'
import { YT, MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

const KIND = {
  video: 'youtube#video'
}

const DB_ARTICLE_TYPE = {
  video: 'YTVideo'
}

async function updateSite(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = Math.floor(date.getTime() / 1000)
  console.log(datetimeStr, 'update site', site.site_id, site.url)
  let { id } = youtube.parseURL(site.url)
  if(!id) {
    console.error(datetimeStr, 'not a valid YouTube url', site.url)
    return null
  }
  let channel, snapshot
  if(site.type === TYPE.channel) {
    channel = await youtube.getChannel(id, 'id,snippet,statistics,contentDetails')
  } else if(site.type === TYPE.user) {
    channel = await youtube.getUser(id, 'id,snippet,statistics,contentDetails')
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
    let sql = mysql.format('INSERT INTO SiteSnapshot SET ?', snapshot)
    let [res] = await pool.query(sql)
    console.log(datetimeStr, res)
  } else {
    console.error(datetimeStr, 'no data', site.type, id)
  }
  return snapshot
}

async function discoverSite(snapshot, pool) {
  let playlistID = snapshot.uploads_playlist_id
  let nextPageToken = -1
  let totalCount = 0
  let itemCount = 0
  let items = []
  const part = 'id,snippet'
  while(nextPageToken !== undefined) {
    let date = new Date()
    let datetimeStr = datetime(date)
    let timestamp = Math.floor(date.getTime() / 1000)
    // get videos (and maybe other items) in channel upload playlist
    let playlistItems = await youtube.getPlaylistItems(playlistID, (nextPageToken !== -1 ? nextPageToken : null), part)
    if(playlistItems) {
      ({ nextPageToken, totalCount, items } = playlistItems)
      items = items.filter(item => item.snippet.resourceId.kind === KIND.video).map(item => {
        return {
          id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channel_id: item.snippet.channel_id, // user who added item to playlist
          // snippet.publishedAt - when item was added to playlist
          playlist_id: item.snippet.playlistId,
          position: item.snippet.position
        }
      })
      // create Article
      let sql, siteInfo
      for(let item of items) {
        let article = {
          site_id: snapshot.site_id,
          url: youtube.getVideoURL(item.id),
          article_type: DB_ARTICLE_TYPE.video,
          created_at: timestamp
        }
        sql = mysql.format('SELECT article_id FROM Article WHERE `site_id` = ? AND `url` = ?', [article.site_id, article.url])
        let [rows] = await pool.query(sql)
        if(rows.length < 1) {
          sql = mysql.format('INSERT INTO Article SET ?', article)
          console.log(sql)
          let [insRes] = await pool.query(sql)
          console.log(insRes)
        }
      }
      itemCount += items.length
      console.log(datetimeStr, 'discover site', snapshot.site_id, playlistID, nextPageToken, itemCount, totalCount)

      siteInfo = {
        playlistID,
        nextPageToken
      }
      sql = mysql.format('UPDATE Site SET site_info = ?, last_crawl_at = ? WHERE site_id = ?', [JSON.stringify(siteInfo), timestamp, snapshot.site_id])
      let [updRes] = await pool.query(sql)
      console.log(updRes)
    }
    await pause()
  } // end of paging loop
}

const UPDATE_SITES = false
const DISCOVER_SITES = true

async function discover(siteID) {
  const pool = await mysql.createPool(MYSQL)
  let snapshots = []
  if(UPDATE_SITES) {
    console.log(datetime(new Date()), 'update site')
    let [rows] = await pool.query('SELECT * FROM Site')
    let sites = siteID ? rows.filter(row => row.site_id === siteID) : rows
    for(let site of sites) {
      let snapshot = await updateSite(site, pool)
      snapshots.push(snapshot)
      await pause()
    }
  } else {
    console.log(datetime(new Date()), 'get latest site snapshot')
    let [rows] = await pool.query('SELECT * FROM SiteSnapshot WHERE (site_id, snapshot_at) IN (SELECT site_id, MAX(snapshot_at) FROM SiteSnapshot GROUP BY site_id ORDER BY MAX(snapshot_at))')
    snapshots = siteID ? rows.filter(row => row.site_id === siteID) : rows
  }
  if(DISCOVER_SITES) {
    console.log(datetime(new Date()), 'discover site')
    for(let snapshot of snapshots) {
      await discoverSite(snapshot, pool)
    }
  }
  await pool.end()
}

let args = process.argv.slice(2)
let siteID = null
if(args.length > 0) {
  siteID = +args[0]
}
discover(siteID)
