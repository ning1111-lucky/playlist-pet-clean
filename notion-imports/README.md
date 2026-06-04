# Notion Import CSVs

Files:

- `genre-rules.csv`
- `users.csv`
- `weekly-runs.csv`

Recommended import order:

1. Import `genre-rules.csv`
2. Import `users.csv`
3. Import `weekly-runs.csv`

Notes:

- These CSVs use text keys such as `genre_key`, `user_name`, and `base_key` so they import cleanly.
- After import, you can keep those columns as plain text, or convert them into Notion relations manually.
- `music_source` values match the current product model:
  - `spotify`
  - `lastfm`
- `genre_key` values match the current app's normalized internal genres:
  - `Kpop`
  - `Classical`
  - `Hiphop`
  - `Country`
  - `Jazz`
  - `Indie`
  - `RnB`
  - `Pop`
