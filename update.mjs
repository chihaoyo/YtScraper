import { pause, datetime } from './lib/util.mjs'
import { TYPE, parseURL, getVideoURL, getVideoID, getThumbnailURL, getChannel, getUser, getPlaylistItems, getVideo } from './lib/yt.mjs'
import { YT, MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

const MAX_ARTICLE_UPDATE = 200

async function updateArticlesOfSite(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = Math.floor(date.getTime() / 1000)
  let [rows] = await pool.query('SELECT * FROM Article WHERE site_id = ? AND next_snapshot_at != 0 AND next_snapshot_at <= ? ORDER BY next_snapshot_at ASC, article_id ASC LIMIT ?', [site.site_id, timestamp, MAX_ARTICLE_UPDATE])
  let articles = rows
  console.log('update', articles.length, 'articles of site', site.site_id)
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
      // prepare article snapshot
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
      // prepare article update
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
      // write snapshot
      try {
        let insSQL = mysql.format('INSERT INTO ArticleSnapshot SET ?', snapshot)
        let [insRes] = await pool.query(insSQL)
        console.log('insert', insRes)
        let updSQL = mysql.format('UPDATE Article SET ? WHERE article_id = ?', [articleUpdates, article.article_id])
        let [updRes] = await pool.query(updSQL)
        console.log('update', updRes)
      } catch(e) {
        console.error(e)
      }
    } else {
      console.error(datetimeStr, 'no data', id)
    }
    await pause(250)
  } // end of article loop
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
