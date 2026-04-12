// Masjid Ali — Lock Screen Widget
// Scriptable app — Circular lock screen widget
// Shows next prayer name, time, and countdown

const PRAYER_TIMES_URL = "https://raw.githubusercontent.com/papapatel911-glitch/masjid-ali/main/public/prayer-times.json";

const PRAYERS = [
  { key: "fajr",    label: "Fajr"    },
  { key: "dhuhr",   label: "Dhuhr"   },
  { key: "asr",     label: "Asr"     },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha",    label: "Isha"    },
];

function timeToMins(str) {
  const parts = str.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function formatTime(str) {
  const parts = str.split(":").map(Number);
  const h = parts[0], m = parts[1];
  const period = h >= 12 ? "PM" : "AM";
  const dh = h % 12 || 12;
  return dh + ":" + m.toString().padStart(2, "0");
}

function getNowMins() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getNext(prayers) {
  const now = getNowMins();
  for (const p of PRAYERS) {
    if (!prayers[p.key]) continue;
    const pm = timeToMins(prayers[p.key]);
    if (pm > now) return { ...p, time: prayers[p.key] };
  }
  const fajr = PRAYERS[0];
  return { ...fajr, time: prayers[fajr.key], tomorrow: true };
}

async function run() {
  let next = null;
  let error = false;

  try {
    const req = new Request(PRAYER_TIMES_URL);
    req.timeoutInterval = 10;
    const data = await req.loadJSON();
    next = getNext(data.prayers);
  } catch (e) {
    error = true;
  }

  const widget = new ListWidget();
  widget.backgroundColor = new Color("#00000000");

  if (error || !next) {
    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();
    const icon = stack.addText("Masjid Ali");
    icon.font = Font.systemFont(10);
    icon.textColor = Color.white();
    icon.centerAlignText();
  } else {
    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();

    // Prayer name
    const label = stack.addText(next.label + (next.tomorrow ? " tmrw" : ""));
    label.font = Font.boldSystemFont(11);
    label.textColor = Color.white();
    label.centerAlignText();
    label.minimumScaleFactor = 0.7;

    stack.addSpacer(1);

    // Prayer time
    const timeText = stack.addText(formatTime(next.time));
    timeText.font = Font.boldSystemFont(13);
    timeText.textColor = Color.white();
    timeText.centerAlignText();
    timeText.minimumScaleFactor = 0.7;

    stack.addSpacer(1);

    // Countdown — "in 1h 45m" or "in 45m"
    const now = getNowMins();
    let diff = timeToMins(next.time) - now;
    if (next.tomorrow) diff += 1440;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const countdownStr = hrs > 0 ? "in " + hrs + "h " + mins + "m" : "in " + mins + "m";

    const countdown = stack.addText(countdownStr);
    countdown.font = Font.mediumSystemFont(10);
    countdown.textColor = new Color("#ffffff", 0.75);
    countdown.centerAlignText();
    countdown.minimumScaleFactor = 0.7;
  }

  if (config.runsInApp) {
    widget.presentAccessoryCircular();
  }

  Script.setWidget(widget);
  Script.complete();
}

await run();

