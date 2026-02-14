const { DateTime } = require("luxon");

const PRAYER_LABELS = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha"
};

const PRAYER_LABELS_ARABIC = {
  fajr: "الفجر",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء"
};

const PRAYER_ORDER = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const DEFAULT_METHOD = 3;
const DEFAULT_SCHOOL = 0;

const API_FIELDS = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha"
};

const cache = new Map();

function toApiDate(dateISO) {
  const [year, month, day] = dateISO.split("-");
  return `${day}-${month}-${year}`;
}

function stripExtraTimeText(raw) {
  if (!raw) {
    return "";
  }
  const match = raw.match(/\d{1,2}:\d{2}/);
  return match ? match[0] : "";
}

function isCityCountryLocation(location) {
  return (
    typeof location?.city === "string" &&
    location.city.trim().length > 0 &&
    typeof location?.country === "string" &&
    location.country.trim().length > 0
  );
}

function isCoordinateLocation(location) {
  return (
    typeof location?.latitude === "number" &&
    typeof location?.longitude === "number" &&
    typeof location?.timezone === "string"
  );
}

function getCacheKey(location, dateISO) {
  if (isCityCountryLocation(location)) {
    return [
      dateISO,
      "city",
      location.city.trim().toLowerCase(),
      location.country.trim().toLowerCase(),
      location.timezone,
      location.method ?? DEFAULT_METHOD,
      location.school ?? DEFAULT_SCHOOL
    ].join("|");
  }

  return [
    dateISO,
    "coords",
    location.latitude,
    location.longitude,
    location.timezone,
    location.method ?? DEFAULT_METHOD,
    location.school ?? DEFAULT_SCHOOL
  ].join("|");
}

function ensureValidTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.trim().length === 0) {
    throw new Error("Could not determine timezone for this location.");
  }

  const check = DateTime.now().setZone(timezone);
  if (!check.isValid) {
    throw new Error(`Prayer API returned invalid timezone: ${timezone}`);
  }
}

function parsePrayerTimesFromTimings({ timings, dateISO, timezone }) {
  const parsed = {};

  for (const prayerKey of PRAYER_ORDER) {
    const apiField = API_FIELDS[prayerKey];
    const value = stripExtraTimeText(timings[apiField]);
    const prayerDateTime = DateTime.fromFormat(`${dateISO} ${value}`, "yyyy-LL-dd HH:mm", {
      zone: timezone
    });

    if (!prayerDateTime.isValid) {
      throw new Error(`Unable to parse prayer time for ${apiField} (${timings[apiField]}).`);
    }

    parsed[prayerKey] = prayerDateTime;
  }

  return parsed;
}

async function fetchApiResponse(endpoint) {
  const response = await fetch(endpoint.toString());
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const apiMessage =
      (typeof json?.data === "string" ? json.data : null) ||
      json?.data?.message ||
      json?.status ||
      "Unknown API error";
    throw new Error(`Prayer API request failed with HTTP ${response.status}: ${apiMessage}`);
  }

  if (!json || json.code !== 200 || !json.data?.timings) {
    throw new Error("Prayer API returned an unexpected response.");
  }

  return json;
}

async function fetchPrayerTimesByCoordinates(location, dateISO) {
  const dateForApi = toApiDate(dateISO);
  const endpoint = new URL(`https://api.aladhan.com/v1/timings/${dateForApi}`);
  endpoint.searchParams.set("latitude", String(location.latitude));
  endpoint.searchParams.set("longitude", String(location.longitude));
  endpoint.searchParams.set("method", String(location.method ?? DEFAULT_METHOD));
  endpoint.searchParams.set("school", String(location.school ?? DEFAULT_SCHOOL));
  endpoint.searchParams.set("timezonestring", location.timezone);

  const json = await fetchApiResponse(endpoint);
  const timezone = json.data.meta?.timezone || location.timezone;
  ensureValidTimezone(timezone);

  const prayers = parsePrayerTimesFromTimings({
    timings: json.data.timings,
    dateISO,
    timezone
  });

  return {
    prayers,
    timezone
  };
}

async function fetchPrayerTimesByCityCountry(location, dateISO) {
  const dateForApi = toApiDate(dateISO);
  const endpoint = new URL(`https://api.aladhan.com/v1/timingsByCity/${dateForApi}`);
  endpoint.searchParams.set("city", location.city.trim());
  endpoint.searchParams.set("country", location.country.trim());
  endpoint.searchParams.set("method", String(location.method ?? DEFAULT_METHOD));
  endpoint.searchParams.set("school", String(location.school ?? DEFAULT_SCHOOL));

  const json = await fetchApiResponse(endpoint);
  const timezone = json.data.meta?.timezone || location.timezone;
  ensureValidTimezone(timezone);

  const prayers = parsePrayerTimesFromTimings({
    timings: json.data.timings,
    dateISO,
    timezone
  });

  return {
    prayers,
    timezone
  };
}

async function fetchPrayerTimesFromApi(location, dateISO) {
  if (isCityCountryLocation(location)) {
    return fetchPrayerTimesByCityCountry(location, dateISO);
  }

  if (isCoordinateLocation(location)) {
    return fetchPrayerTimesByCoordinates(location, dateISO);
  }

  throw new Error("Invalid location format. Please configure location again.");
}

async function resolveCityCountryLocation({ city, country, method, school }) {
  const normalizedCity = city.trim();
  const normalizedCountry = country.trim();
  const normalizedMethod = method ?? DEFAULT_METHOD;
  const normalizedSchool = school ?? DEFAULT_SCHOOL;

  if (!normalizedCity || !normalizedCountry) {
    throw new Error("City and country are required.");
  }

  const todayISO = DateTime.utc().toISODate();
  const { timezone } = await fetchPrayerTimesByCityCountry(
    {
      city: normalizedCity,
      country: normalizedCountry,
      method: normalizedMethod,
      school: normalizedSchool
    },
    todayISO
  );

  return {
    city: normalizedCity,
    country: normalizedCountry,
    timezone,
    method: normalizedMethod,
    school: normalizedSchool
  };
}

async function getPrayerTimesForDate(location, dateTimeInZone) {
  const zone = location.timezone || "UTC";
  const dateISO = dateTimeInZone.setZone(zone).toISODate();
  const cacheKey = getCacheKey(location, dateISO);

  if (cache.has(cacheKey)) {
    return {
      dateISO,
      prayers: cache.get(cacheKey)
    };
  }

  const { prayers } = await fetchPrayerTimesFromApi(location, dateISO);
  cache.set(cacheKey, prayers);
  return { dateISO, prayers };
}

async function getNextPrayer(location, now) {
  const nowInZone = now.setZone(location.timezone);
  const today = await getPrayerTimesForDate(location, nowInZone);

  for (const prayerKey of PRAYER_ORDER) {
    const prayerTime = today.prayers[prayerKey];
    if (nowInZone < prayerTime) {
      return {
        prayerKey,
        prayerLabel: PRAYER_LABELS[prayerKey],
        time: prayerTime
      };
    }
  }

  const tomorrow = await getPrayerTimesForDate(location, nowInZone.plus({ days: 1 }));
  return {
    prayerKey: "fajr",
    prayerLabel: PRAYER_LABELS.fajr,
    time: tomorrow.prayers.fajr
  };
}

module.exports = {
  PRAYER_LABELS,
  PRAYER_LABELS_ARABIC,
  PRAYER_ORDER,
  getNextPrayer,
  getPrayerTimesForDate,
  resolveCityCountryLocation
};
