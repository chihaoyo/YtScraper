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

## Initialize `Site` table
- `npm run init-sites` - Fetch data from Airtable and insert to `Site` table

## Discover
