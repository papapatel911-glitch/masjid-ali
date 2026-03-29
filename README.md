# Masjid Ali — Prayer Times App

A free PWA + Telegram notification system for Masjid Ali (masjidali.ca), Scarborough.

## What this does
- Shows all 5 daily prayer times scraped from the mosque website
- Sends you a Telegram notification ~10 minutes before each prayer
- Works as a home-screen app on your iPhone (no App Store needed)
- Everything is free

## Architecture
```
masjidali.ca → GitHub Actions (scraper) → prayer-times.json
                                         ↓
                                    Vercel (PWA + API)
                                         ↓
                              cron-job.org (every 10 min)
                                         ↓
                                   Telegram Bot
                                         ↓
                                   Your iPhone
```

## Setup (follow the step-by-step guide)

### Environment Variables (set in Vercel)
| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram chat/user ID |
| `PRAYER_TIMES_URL` | Raw GitHub URL to `public/prayer-times.json` |
| `CRON_SECRET` | Optional: a random string to protect the API endpoint |

### File Structure
```
├── public/
│   ├── index.html          # The PWA app
│   ├── manifest.json       # Makes it installable on iPhone
│   ├── sw.js               # Service worker (offline support)
│   └── prayer-times.json   # Auto-updated by scraper
├── api/
│   └── check-prayers.js    # Vercel serverless function
├── scripts/
│   └── scrape.js           # Prayer time scraper
├── .github/workflows/
│   └── scrape.yml          # Runs scraper every 6 hours
└── vercel.json             # Vercel config
```
