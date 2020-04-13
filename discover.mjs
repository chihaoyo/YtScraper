import { pause, datetime } from './lib/util.mjs'
import * as youtube from './lib/yt.mjs'
import { MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

const KIND = {
  video: 'youtube#video'
}

const DB_ARTICLE_TYPE = {
  video: 'YTVideo'
}

async function discoverSite(site, pool) {
  let siteInfo = JSON.parse(site.site_info)
  let playlistID = siteInfo.playlistID
  let nextPageToken = siteInfo.nextPageToken ? siteInfo.nextPageToken : -1

  let [res] = await pool.query('SELECT count(*) AS count FROM Article WHERE site_id = ?', site.site_id)
  let articleCount = res[0].count

  let totalCount = 0
  let itemCount = 0
  let items = []
  const part = 'id,snippet'
  while(nextPageToken !== undefined) {
    let date = new Date()
    let datetimeStr = datetime(date)
    let timestamp = Math.floor(date.getTime() / 1000)
    // get videos (and maybe other items) in channel upload playlist
    console.log(datetimeStr, 'discover site', site.site_id, playlistID, nextPageToken)
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
          site_id: site.site_id,
          url: item.id,
          article_type: DB_ARTICLE_TYPE.video,
          created_at: timestamp
        }
        sql = mysql.format('SELECT article_id FROM Article WHERE `site_id` = ? AND `url` = ?', [article.site_id, article.url])
        let [rows] = await pool.query(sql)
        if(rows.length < 1) {
          sql = mysql.format('INSERT INTO Article SET ?', article)
          let [insRes] = await pool.query(sql)
          console.log('create article', insRes.insertId, article.url)
        }
      }
      itemCount += items.length
      console.log(datetimeStr, 'discover site', site.site_id, itemCount, (itemCount + articleCount), totalCount)

      siteInfo = {
        playlistID,
        nextPageToken
      }
      sql = mysql.format('UPDATE Site SET site_info = ?, last_crawl_at = ? WHERE site_id = ?', [JSON.stringify(siteInfo), timestamp, site.site_id])
      let [updRes] = await pool.query(sql)
      console.log('update site', site.site_id, siteInfo, updRes)
    }
    await pause(500)
  } // end of paging loop
}

async function discover(siteID) {
  const pool = await mysql.createPool(MYSQL)

  console.log(datetime(), 'get sites')
  let [rows] = await pool.query('SELECT * FROM Site')
  let sites = siteID ? rows.filter(row => row.site_id === siteID) : rows

  console.log(datetime(), 'discover sites')
  for(let site of sites) {
    await discoverSite(site, pool)
  }
  await pool.end()
}

let args = process.argv.slice(2)
let siteID
if(args.length > 0) {
  siteID = +args[0]
}
discover(siteID)
