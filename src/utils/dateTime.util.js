import { DateTime } from "luxon";

export const toUTC = (isoDateTime, timezone) => {
  if (!isoDateTime || !timezone) {
    throw new Error("DateTime and timezone are required");
  }

  const dt = DateTime.fromISO(isoDateTime, { zone: timezone });

  if (!dt.isValid) {
    throw new Error("Invalid date or timezone");
  }

  return dt.toUTC().toJSDate();
};

export const fromUTC = (utcDate, timezone) => {
  if (!utcDate || !timezone) {
    throw new Error("UTC date and timezone are required");
  }

  return DateTime
    .fromJSDate(utcDate, { zone: "utc" })
    .setZone(timezone)
    .toISO({ suppressSeconds: true });
};