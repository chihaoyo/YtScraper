import { pause, datetime } from './lib/util.mjs'
import { TYPE, parseURL, getVideoURL, getVideoID, getThumbnailURL, getChannel, getUser, getPlaylistItems, getVideo } from './lib/yt.mjs'
import { YT, MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

async function updateArticlesOfSite(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = Math.floor(date.getTime() / 1000)
  console.log('update article of site', site.site_id)
  let [rows] = await pool.query('SELECT * FROM Article WHERE site_id = ? AND next_snapshot_at != 0 AND next_snapshot_at <= ? ORDER BY next_snapshot_at ASC, article_id ASC', [site.site_id, timestamp])
  let articles = rows
  for(let article of articles) {
    console.log('update article', article.article_id, article.url)
    date = new Date()
    datetimeStr = datetime(date)
    timestamp = Math.floor(date.getTime() / 1000)

    const part = 'id,snippet,statistics'
    let id = getVideoID(article.url)
    let video, snapshot
    try {
      video = await getVideo(id, part)
    } catch(err) {
      console.error(err)
    }
    if(video) {
      let sql, res
      snapshot = {
        article_id: article.article_id,
        snapshot_at: timestamp,
        raw_data: JSON.stringify(video)
      }
      if(video.snippet) {
        Object.assign(snapshot, {
          title: video.snippet.title,
          description: video.snippet.description,
          published_at: Math.floor((new Date(video.snippet.publishedAt)).getTime() / 1000),
          thumbnail_url: getThumbnailURL(video.snippet.thumbnails)
        })
      }
      if(video.statistics) {
        Object.assign(snapshot, {
          view_count: +video.statistics.viewCount,
          like_count: +video.statistics.likeCount,
          dislike_count: +video.statistics.dislikeCount,
          favorite_count: +video.statistics.favoriteCount,
          comment_count: +video.statistics.commentCount
        })
      }
      // write snapshot
      sql = mysql.format('INSERT INTO ArticleSnapshot SET ?', snapshot)
      [res] = await pool.query(sql)
      console.log(res)
      // update Article
      const day = 24 * 60 * 60
      let snapshot_count = article.snapshot_count + 1
      let next_snapshot_at
      if(snapshot.published_at < timestamp - day * 60) {
        next_snapshot_at = 0
      } else if(snapshot_count < 3) {
        next_snapshot_at = timestamp + day
      } else if(snapshot_count < 4) {
        next_snapshot_at = timestamp + day * 4
      } else {
        next_snapshot_at = 0
      }
      let articleUpdates = {
        ...(article.first_snapshot_at === -1 ? { first_snapshot_at: timestamp } : {}),
        last_snapshot_at: timestamp,
        next_snapshot_at,
        snapshot_count
      }
      console.log(articleUpdates)
      sql = mysql.format('UPDATE Article SET ? WHERE article_id = ?', [articleUpdates, article.article_id])
      [res] = await pool.query(sql)
      console.log(res)
    } else {
      console.error(datetimeStr, 'no data', id)
    }
    await pause(250)
  }
}

const UPDATE_ARTICLES = true

async function update() {
  const pool = await mysql.createPool(MYSQL)
  if(UPDATE_ARTICLES) {
    let [rows] = await pool.query('SELECT * FROM Site')
    let sites = rows
    for(let site of sites) {
      await updateArticlesOfSite(site, pool)
      await pause()
    }
  }
  await pool.end()
}

update()
