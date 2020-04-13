import { pause, datetime, ANSWERS, prompt } from './lib/util.mjs'
import * as youtube from './lib/yt.mjs'
import { MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

const PAGE = 50
const MAX_UPDATES_PER_SITE = 500 // round robin

async function updateArticlesOfSite(site, pool) {
  let date = new Date()
  let datetimeStr = datetime(date)
  let timestamp = Math.floor(date.getTime() / 1000)
  let [rows] = await pool.query('SELECT * FROM Article WHERE site_id = ? AND next_snapshot_at != 0 AND next_snapshot_at <= ? ORDER BY next_snapshot_at ASC, article_id ASC LIMIT ?', [site.site_id, timestamp, MAX_UPDATES_PER_SITE])
  let articles = rows
  console.log(datetimeStr, 'update', articles.length, 'articles of site', site.site_id)
  if(articles.length < 1) {
    return
  }
  console.log(datetimeStr, articles.length, 'articles', articles[0].article_id, articles[articles.length - 1].article_id)

  let counter = 0
  for(let article of articles) {
    answer = ANSWERS.yes
    if(isInteractive && ask && counter % PAGE === 0) {
      answer = await prompt()
      if(answer === ANSWERS.stopAsking) {
        ask = false
      } else if(answer === ANSWERS.skip) {
        break
      } else if(answer === ANSWERS.abort) {
        process.abort()
      }
    }

    date = new Date()
    datetimeStr = datetime(date)
    timestamp = Math.floor(date.getTime() / 1000)
    console.log(datetimeStr, (counter + 1), articles.length, 'update article', article.article_id, 'of site', site.site_id, article.url)

    const part = 'id,snippet,statistics'
    let id = article.url
    let video, snapshot
    video = await youtube.getVideo(id, part)
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
          thumbnail_url: youtube.getThumbnailURL(video.snippet.thumbnails)
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
        console.log(insRes)
        let updSQL = mysql.format('UPDATE Article SET ? WHERE article_id = ?', [articleUpdates, article.article_id])
        let [updRes] = await pool.query(updSQL)
        console.log(updRes)
      } catch(e) {
        console.error(e)
      }
    } else {
      console.error(datetimeStr, 'no data', id)
    }
    counter += 1
    await pause()
  } // end of article loop
  console.log(datetime(), counter, 'articles updated')
}

async function update(siteID) {
  const pool = await mysql.createPool(MYSQL)
  let [rows] = await pool.query('SELECT * FROM Site')
  let sites = siteID ? rows.filter(row => row.site_id === siteID) : rows
  for(let site of sites) {
    await updateArticlesOfSite(site, pool)
    await pause()
  }
  await pool.end()
}

let args = process.argv.slice(2)
let siteID = null
let isInteractive = false
let answer = null
let ask = false
if(args.includes('-i')) {
  isInteractive = true
  ask = true
  args = args.filter(arg => arg !== '-i')
}
if(args.length > 0) {
  siteID = +args[0]
}
update(siteID)
