# YtScraper

This scrapes YouTube.

Use node 10.

## Add channels to Airtable
- Paste urls into text file `data/urls.txt`
- `npm run urls-to-sites`
  - For each url fetch data from YouTube
  - Save fetched data to `channels-{timestamp}.json`
  - Generate tsv
- Paste tsv to Airtable

## Update `Site` table
- `npm run update-sites` - Fetch data from Airtable and update into `Site` table

## Discover
- `npm run discover` - Fetch data from YouTube and insert into `SiteSnapshot` table
