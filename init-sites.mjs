import fs from 'fs'
import Airtable from 'airtable'
import mysql from 'mysql' // FIXME: use mysql2
import { AT, MYSQL } from './config.mjs'

const AT_MAX_RECORDS = 100
const AT_TYPE_CHANNEL = 'YouTube 頻道'
const AT_TYPE_USER = 'YouTube 帳號'
const TYPE_MAP = {
  [AT_TYPE_CHANNEL]: 'channel',
  [AT_TYPE_USER]: 'user'
}

// init
Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: AT.key
})
let base = Airtable.base(AT.baseID)

// fetch
let sites = []
base(AT.table).select({
  maxRecords: AT_MAX_RECORDS,
  view: AT.view,
  filterByFormula: 'FIND("YouTube", {type})'
}).eachPage((records, fetchNextPage) => {
  records.forEach(record => {
    let site = record.fields
    site.type = (TYPE_MAP[site.type] !== undefined ? TYPE_MAP[site.type] : site.type)
    sites.push(site)
  })
  fetchNextPage()
}, err => {
  if(err) {
    console.error(err)
    return
  }
  fs.writeFile('data/sites.json', JSON.stringify(sites), err => {
    if(err) {
      console.error(err)
    }
  })

  let cnct = mysql.createConnection(MYSQL)
  cnct.connect()
  let sql = 'INSERT INTO Site(type, name, url, airtable_id) VALUES'
    + sites.map(site => `(${cnct.escape(site.type)}, ${cnct.escape(site.name)}, ${cnct.escape(site.url)}, ${cnct.escape(site.id)})`).join(',')
    + ';'
  cnct.query(sql, (err, res, fields) => {
    if(err) {
      console.error(err)
      return
    }
    console.log(res)
  })
  cnct.end()
})
