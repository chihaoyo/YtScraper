import { datetime } from './lib/util.mjs'
import * as youtube from './lib/yt.mjs'
import { MYSQL } from './config.mjs'
import mysql from 'mysql2/promise'

async function poke(playlistID, pageToken) {
  console.log('poke', playlistID, pageToken)
  const pool = await mysql.createPool(MYSQL)

  const part = 'id,snippet'
  let { nextPageToken, totalCount, items } = await youtube.getPlaylistItems(playlistID, pageToken, part)
  for(let item of items) {
    try {
      let [res] = await pool.query('SELECT * FROM Article WHERE url = ?', item.snippet.resourceId.videoId)
      console.log(item.snippet.title, item.snippet.resourceId, (res.length > 0 ? res[0].article_id : '-'))
    } catch(e) {
      console.error(e)
    }
  }
  console.log('poke', playlistID, pageToken, nextPageToken, totalCount)
  await pool.end()
}

let playlistID = 'UUpu3bemTQwAU8PqM4kJdoEQ'
let pageToken = 'CKKQAhAA'

poke(playlistID, pageToken)

// CKSHAhAA
// CNaHAhAA
// CIiIAhAA
// CLqIAhAA
// COyIAhAA
// CJ6JAhAA
// CNCJAhAA
