import fs from 'fs'
import Airtable from 'airtable'
import mysql from 'mysql2/promise'
import { pause } from './lib/util.mjs'
import { TYPE } from './lib/yt.mjs'
import { AT, MYSQL } from './config.mjs'

const AT_MAX_RECORDS = 100
const AT_TYPE_CHANNEL = 'YouTube 頻道'
const AT_TYPE_USER = 'YouTube 帳號'
const TYPE_MAP = {
  [AT_TYPE_CHANNEL]: TYPE.channel,
  [AT_TYPE_USER]: TYPE.user
}

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: AT.key
})
const base = Airtable.base(AT.baseID)

async function update() {
  let rows = await base(AT.table).select({
    maxRecords: AT_MAX_RECORDS,
    view: AT.view,
    filterByFormula: 'FIND("YouTube", {type})'
  }).all()
  let sites = rows.map(row => ({
    type: (TYPE_MAP[row.fields.type] !== undefined ? TYPE_MAP[row.fields.type] : row.fields.type),
    name: row.fields.name,
    url: row.fields.url,
    airtable_id: row.id
  }))

  const pool = await mysql.createPool(MYSQL)
  for(let site of sites) {
    console.log('Query site', site.name, site.url)
    let [rows, fields] = await pool.query('SELECT * FROM Site WHERE url = ?', site.url)
    if(rows.length < 1) {
      console.log('Add site', site.name, site.url)
      let [res] = await pool.query('INSERT INTO Site SET ?', site)
      console.log(res)
    }
    await pause()
  }
  await pool.end()
}

update()
