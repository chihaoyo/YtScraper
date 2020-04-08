# YtScraper

This scrapes YouTube.

Use node 10.

## Add channels to Airtable
- Paste urls into text file `data/urls.txt`
- Run `npm run urls-to-sites`
  - For each url fetch data from YouTube
  - Save fetched data to `channels-{timestamp}.json`
  - Generate tsv
- Paste tsv to Airtable

## Update `Site` table
`npm run update-sites`

- Fetch site data from Airtable and update into `Site` table
  - Use `airtable_id` to determine if site is already in `Site` table

## Discover
`npm run discover`

### Update site
For each `Site`...
- Fetch channel data from YouTube and create new `SiteSnapshot`

### Discover site
For each `Site`...
- Use latest `SiteSnapshot` of the `Site`
- Fetch videos in playlist `SiteSnapshot.uploads_playlist_id`

For each video of each page of playlist...
- Create new `Article` if `site_id` && `url` not in `Article` table
- Update `Site.site_info` with `playlistID` & `nextPageToken`
- Update `Site.last_crawl_at` with current time

## Update
`npm run update`

Get `Article` for each `Site`...
- `next_snapshot_at` != 0 && <= current time
- Sort by `next_snapshot_at` in ascending order

For each `Article`...
- Fetch video data from YouTube
- Create new `ArticleSnapshot`
- Update `Article`
  - `snapshot_count` += 1
  - `first_snapshot_at` if first snapshot
  - `last_snapshot_at` with current time
  - `next_snapshot_at`
    - If `ArticleSnapshot.published_at` is more than 2 months ago
    - If `snapshot_count` < 3... current time + 1 day
    - Else if < 4... current time + 4 days
    - Else... 0
