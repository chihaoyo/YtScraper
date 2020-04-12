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

async function discover(siteID) {
  const pool = await mysql.createPool(MYSQL)
  let snapshots = []

  console.log(datetime(), 'get latest site snapshots')
  let [rows] = await pool.query('SELECT * FROM SiteSnapshot WHERE (site_id, snapshot_at) IN (SELECT site_id, MAX(snapshot_at) FROM SiteSnapshot GROUP BY site_id ORDER BY MAX(snapshot_at))')
  snapshots = siteID ? rows.filter(row => row.site_id === siteID) : rows

  console.log(datetime(), 'discover sites')
  for(let snapshot of snapshots) {
    await discoverSite(snapshot, pool)
  }
  await pool.end()
}

let args = process.argv.slice(2)
let siteID = null
let isInteractive = false
let answer = null
if(args.includes('-i')) {
  isInteractive = true
  args = args.filter(arg => arg !== '-i')
}
if(args.length > 0) {
  siteID = +args[0]
}
discover(siteID)
