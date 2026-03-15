const { DateTime } = require("luxon");

/**
 * Parsea hora en formato:
 * - 14:30
 * - 3pm
 * - 3:30pm
 */
function parseTimeInput(text) {
  if (!text) return null;

  const clean = text.trim().toLowerCase();

  // 24h format HH:mm
  const time24Regex = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
  const match24 = clean.match(time24Regex);

  if (match24) {
    const hour = match24[1].padStart(2, "0");
    const minute = match24[2];
    return `${hour}:${minute}`;
  }

  // 12h format
  const time12Regex = /^(\d{1,2})(?::([0-5]\d))?(am|pm)$/;
  const match12 = clean.replace(/\s+/g, "").match(time12Regex);

  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = match12[2] || "00";
    const period = match12[3];

    if (hour >= 1 && hour <= 12) {
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;

      return `${hour.toString().padStart(2, "0")}:${minute}`;
    }
  }

  return null;
}

/**
 * Construye DateTime y valida que sea futuro
 */
function buildFutureDateTime({ dateISO, time, timeZone }) {
  const proposed = DateTime.fromISO(
    `${dateISO}T${time}`,
    { zone: timeZone }
  );

  if (!proposed.isValid) return null;

  const now = DateTime.now().setZone(timeZone);

  if (proposed <= now) return null;

  return proposed;
}

module.exports = {
  parseTimeInput,
  buildFutureDateTime
};