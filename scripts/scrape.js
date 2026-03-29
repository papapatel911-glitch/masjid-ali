// scripts/scrape.js
// Scrapes prayer times from masjidali.ca and saves to public/prayer-times.json
// Runs via GitHub Actions every 6 hours

const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MasjidAliBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    };
    https.get(url, options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseTime(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  if (str.includes('sunset') || str === 'sunset') return 'SUNSET';

  // Match "6:15 am", "7:45pm", "13:30", "1:30 PM" etc.
  const match = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return null;

  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3] ? match[3].toLowerCase() : null;

  if (period === 'pm' && h !== 12) h += 12;
  if (period === 'am' && h === 12) h = 0;

  // Sanity check
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Get Maghrib (sunset) time from Aladhan API using Masjid Ali's coordinates
async function fetchSunsetFromAladhan() {
  const lat = 43.7756;  // Masjid Ali, Scarborough, ON
  const lng = -79.1857;
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2,'0')}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=2`;

  try {
    console.log('  → Fetching Maghrib/sunset from Aladhan API...');
    const raw = await fetchUrl(url);
    const json = JSON.parse(raw);
    if (json.code === 200 && json.data?.timings?.Maghrib) {
      const t = json.data.timings.Maghrib; // Format: "HH:MM"
      console.log(`  → Got Maghrib from Aladhan: ${t}`);
      return t;
    }
  } catch (e) {
    console.error('  → Aladhan API failed:', e.message);
  }
  return null;
}

// Extract prayer times from raw text using multiple strategies
function extractFromText(text) {
  const result = {};
  const clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    { key: 'fajr',    regex: /fajr\s*[:\-]?\s*(\d{1,2}:\d{2}\s*(?:am|pm)?|sunset)/gi },
    { key: 'dhuhr',   regex: /d[hzu][uh]?r\s*[:\-]?\s*(\d{1,2}:\d{2}\s*(?:am|pm)?|sunset)/gi },
    { key: 'asr',     regex: /asr\s*[:\-]?\s*(\d{1,2}:\d{2}\s*(?:am|pm)?|sunset)/gi },
    { key: 'maghrib', regex: /maghrib\s*[:\-]?\s*(\d{1,2}:\d{2}\s*(?:am|pm)?|sunset)/gi },
    { key: 'isha',    regex: /isha\s*[:\-]?\s*(\d{1,2}:\d{2}\s*(?:am|pm)?|sunset)/gi },
  ];

  for (const { key, regex } of patterns) {
    regex.lastIndex = 0;
    const match = regex.exec(clean);
    if (match) {
      const parsed = parseTime(match[1]);
      if (parsed) result[key] = parsed;
    }
  }

  return result;
}

// Fallback: find all times in document and map them to prayer order
function extractFallback(text) {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Find sections labelled with prayer names
  const prayerOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const result = {};

  // Try: find all "NAME ... TIME" patterns anywhere
  const lines = clean.split(/[.\n\r]+/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const key of prayerOrder) {
      if (result[key]) continue;
      const alias = key === 'dhuhr' ? ['dhuhr', 'duhr', 'zuhr'] : [key];
      if (alias.some(a => lower.includes(a))) {
        const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
        if (timeMatch) {
          const parsed = parseTime(timeMatch[1]);
          if (parsed) result[key] = parsed;
        }
        // Sunset for Maghrib
        if (key === 'maghrib' && lower.includes('sunset')) {
          result[key] = 'SUNSET';
        }
      }
    }
  }

  return result;
}

async function scrapePrayerTimes() {
  console.log('Fetching https://masjidali.ca/daily-prayers/ ...');
  const html = await fetchUrl('https://masjidali.ca/daily-prayers/');

  console.log('Extracting prayer times...');
  let prayers = extractFromText(html);
  const found = Object.keys(prayers).length;
  console.log(`  → Found ${found} prayers via primary extraction`);

  if (found < 4) {
    console.log('  → Trying fallback extraction...');
    const fallback = extractFallback(html);
    prayers = { ...fallback, ...prayers }; // primary takes precedence
    console.log(`  → Found ${Object.keys(prayers).length} prayers after fallback`);
  }

  // Resolve SUNSET placeholder for Maghrib
  if (prayers.maghrib === 'SUNSET') {
    const sunset = await fetchSunsetFromAladhan();
    prayers.maghrib = sunset || null;
  }

  return prayers;
}

async function main() {
  try {
    const prayers = await scrapePrayerTimes();

    const missing = ['fajr','dhuhr','asr','maghrib','isha'].filter(k => !prayers[k]);
    if (missing.length > 3) {
      throw new Error(`Scraping failed — too many missing prayers: ${missing.join(', ')}`);
    }
    if (missing.length > 0) {
      console.warn('⚠ Missing prayers:', missing.join(', '));
    }

    const output = {
      date: new Date().toISOString(),
      scraped_from: 'https://masjidali.ca/daily-prayers/',
      prayers: {
        fajr:    prayers.fajr    || null,
        dhuhr:   prayers.dhuhr   || null,
        asr:     prayers.asr     || null,
        maghrib: prayers.maghrib || null,
        isha:    prayers.isha    || null,
      }
    };

    const outputPath = path.join(__dirname, '..', 'public', 'prayer-times.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('\n✅ Saved prayer times:');
    Object.entries(output.prayers).forEach(([k, v]) => {
      console.log(`   ${k.padEnd(8)} ${v || '(missing)'}`);
    });

  } catch (err) {
    console.error('\n❌ Scraper failed:', err.message);
    process.exit(1);
  }
}

main();
