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

const UPDATE_ARTICLE_FIRST_SEEN_FIELDS = false

async function discoverSite(site, pool) {
  let siteInfo = JSON.parse(site.site_info)
  let playlistID = siteInfo.playlistID
  let nextPageToken = siteInfo.nextPageToken ? siteInfo.nextPageToken : -1

  let [res] = await pool.query('SELECT count(*) AS count FROM Article WHERE site_id = ?', site.site_id)
  let existingArticleCount = res[0].count

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
          thumbnail_url: youtube.getThumbnailURL(item.snippet.thumbnails),
          channel_id: item.snippet.channel_id, // user who added item to playlist
          published_to_pl_at: Math.floor((new Date(item.snippet.publishedAt)).getTime() / 1000), // when item was added to playlist
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
          first_seen_at: timestamp,
          first_seen_title: item.title,
          first_seen_description: item.description,
          first_seen_thumbnail_url: item.thumbnail_url,
          first_seen_published_at: item.published_to_pl_at
        }
        sql = mysql.format('SELECT article_id FROM Article WHERE `site_id` = ? AND `url` = ?', [article.site_id, article.url])
        let [rows] = await pool.query(sql)
        if(rows.length < 1) {
          sql = mysql.format('INSERT INTO Article SET ?', article)
          let [insRes] = await pool.query(sql)
          console.log('db insert site', article.site_id, 'article', insRes.insertId, article.url)
        } else if (UPDATE_ARTICLE_FIRST_SEEN_FIELDS) {
          let existingArticleID = rows[0].article_id
          sql = mysql.format('UPDATE Article SET first_seen_title = ?, first_seen_description = ?, first_seen_thumbnail_url = ?, first_seen_published_at = ? WHERE article_id = ?', [article.first_seen_title, article.first_seen_description, article.first_seen_thumbnail_url, article.first_seen_published_at, existingArticleID])
          let [updRes] = await pool.query(sql)
          console.log('db update site', article.site_id, 'article', existingArticleID, updRes.info)
        }
      }
      itemCount += items.length
      console.log(datetimeStr, 'discover site', site.site_id, itemCount, totalCount, 'existing', existingArticleCount)

      siteInfo = {
        playlistID,
        nextPageToken,
        totalCount
      }
      sql = mysql.format('UPDATE Site SET site_info = ?, last_crawl_at = ? WHERE site_id = ?', [JSON.stringify(siteInfo), timestamp, site.site_id])
      let [updRes] = await pool.query(sql)
      console.log('db update site info', site.site_id, siteInfo, updRes.info)
    }
    await pause(500)
  } // end of paging loop
}

async function discover(siteIDs) {
  const pool = await mysql.createPool(MYSQL)

  console.log(datetime(), 'get sites', ...(siteIDs ? siteIDs : []))
  let sql
  if(siteIDs && siteIDs.length > 0) {
    sql = mysql.format('SELECT * FROM Site WHERE site_id IN (?)', [siteIDs])
  } else {
    sql = mysql.format('SELECT * FROM Site')
  }
  let [sites] = await pool.query(sql)

  console.log(datetime(), 'discover sites', ...sites.map(site => site.site_id))
  for(let site of sites) {
    await discoverSite(site, pool)
  }
  await pool.end()
}

let args = process.argv.slice(2)
let siteIDs
if(args.length > 0) {
  siteIDs = args.map(arg => +arg)
}
discover(siteIDs)
