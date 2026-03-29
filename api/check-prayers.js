// api/check-prayers.js
// Vercel serverless function
// Called every 10 minutes by cron-job.org
// Checks if any prayer is ~10 minutes away and sends a Telegram notification

const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const PRAYER_TIMES_URL   = process.env.PRAYER_TIMES_URL; // raw.githubusercontent.com URL

// Notify window: send alert when prayer is between MIN and MAX minutes away
const NOTIFY_MIN = 9;
const NOTIFY_MAX = 16;

const PRAYER_DISPLAY = {
  fajr:    { name: 'Fajr',    emoji: '🌅' },
  dhuhr:   { name: 'Dhuhr',   emoji: '☀️'  },
  asr:     { name: 'Asr',     emoji: '🌤'  },
  maghrib: { name: 'Maghrib', emoji: '🌇' },
  isha:    { name: "Isha'a",  emoji: '🌙' },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MasjidAliBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
    }).on('error', reject);
  });
}

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML'
    });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function timeToMins(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(str) {
  const [h, m] = str.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  return `${dh}:${m.toString().padStart(2, '0')} ${period}`;
}

function getTorontoMinutes() {
  // Get current time in Toronto timezone
  const now = new Date();
  const toronto = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  return toronto.getHours() * 60 + toronto.getMinutes();
}

module.exports = async (req, res) => {
  // Basic security: allow GET and POST, ignore other methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: secret token check to prevent abuse
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers['x-cron-secret'] || req.query.secret;
    if (provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !PRAYER_TIMES_URL) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const data = await fetchJson(PRAYER_TIMES_URL);
    const prayers = data.prayers;
    const nowMins = getTorontoMinutes();

    const results = [];
    let notified = false;

    for (const [key, timeStr] of Object.entries(prayers)) {
      if (!timeStr) continue;

      const prayerMins = timeToMins(timeStr);
      const diff = prayerMins - nowMins;
      const info = PRAYER_DISPLAY[key] || { name: key, emoji: '🕌' };

      results.push({ prayer: key, time: timeStr, diff, window: diff >= NOTIFY_MIN && diff <= NOTIFY_MAX });

      if (diff >= NOTIFY_MIN && diff <= NOTIFY_MAX) {
        const message =
          `${info.emoji} <b>${info.name}</b> in ${diff} minutes\n` +
          `⏰ Time: <b>${formatTime(timeStr)}</b>\n\n` +
          `Time to get ready and head to Masjid Ali إن شاء الله 🕌`;

        console.log(`Sending notification for ${key} (${diff} min away)`);
        await sendTelegram(message);
        notified = true;
      }
    }

    return res.status(200).json({
      ok: true,
      notified,
      currentTime: `${Math.floor(nowMins/60).toString().padStart(2,'0')}:${(nowMins%60).toString().padStart(2,'0')}`,
      prayers: results
    });

  } catch (err) {
    console.error('check-prayers error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
