// Masjid Ali — Lock Screen Widget
// Scriptable app — Circular lock screen widget
// Shows next prayer time + name
//
// SETUP: Replace the URL below with your own after completing the main app setup
// It should look like: https://raw.githubusercontent.com/YOUR_USERNAME/masjid-ali/main/public/prayer-times.json

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
  return `${dh}:${m.toString().padStart(2, "0")}`;
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
  // All done today — show Fajr (tomorrow)
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
  widget.backgroundColor = new Color("#00000000"); // transparent

  if (error || !next) {
    // Error state
    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();

    const icon = stack.addText("🕌");
    icon.font = Font.systemFont(20);
    icon.centerAlignText();

    stack.addSpacer(2);

    const label = stack.addText("—");
    label.font = Font.boldSystemFont(11);
    label.textColor = Color.white();
    label.centerAlignText();

  } else {
    // Normal state — show time + prayer name label
    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();

    // Time (main number — big)
    const timeText = stack.addText(formatTime(next.time));
    timeText.font = Font.boldSystemFont(15);
    timeText.textColor = Color.white();
    timeText.centerAlignText();
    timeText.minimumScaleFactor = 0.7;

    stack.addSpacer(2);

    // Prayer name label
    const label = stack.addText(next.label + (next.tomorrow ? " ↑" : ""));
    label.font = Font.mediumSystemFont(11);
    label.textColor = new Color("#ffffff", 0.85);
    label.centerAlignText();
    label.minimumScaleFactor = 0.8;
  }

  // For previewing in app
  if (config.runsInApp) {
    widget.presentAccessoryCircular();
  }

  Script.setWidget(widget);
  Script.complete();
}

await run();
