const test = require("node:test");
const assert = require("node:assert/strict");
const { DateTime } = require("luxon");

const {
  getNextPrayer,
  getPrayerTimesForDate,
  resolveCityCountryLocation
} = require("../src/prayerTimesService");

function buildPrayerApiResponse({ timezone = "UTC" } = {}) {
  return {
    code: 200,
    data: {
      timings: {
        Fajr: "05:00",
        Dhuhr: "13:00",
        Asr: "16:30",
        Maghrib: "18:15",
        Isha: "19:45"
      },
      meta: { timezone }
    }
  };
}

async function withMockFetch(mockFetch, fn) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

test("resolveCityCountryLocation returns normalized location and timezone", async () => {
  await withMockFetch(
    async () => ({
      ok: true,
      json: async () => buildPrayerApiResponse({ timezone: "UTC" })
    }),
    async () => {
      const location = await resolveCityCountryLocation({
        city: "London",
        country: "United Kingdom",
        method: 3,
        school: 0
      });
      assert.equal(location.city, "London");
      assert.equal(location.country, "United Kingdom");
      assert.equal(location.timezone, "UTC");
      assert.equal(location.method, 3);
      assert.equal(location.school, 0);
    }
  );
});

test("getPrayerTimesForDate and getNextPrayer use API timings", async () => {
  await withMockFetch(
    async () => ({
      ok: true,
      json: async () => buildPrayerApiResponse({ timezone: "UTC" })
    }),
    async () => {
      const location = {
        city: "Test City",
        country: "Test Country",
        timezone: "UTC",
        method: 3,
        school: 0
      };
      const day = DateTime.fromISO("2026-02-15T00:00:00Z", { zone: "UTC" });
      const daily = await getPrayerTimesForDate(location, day);
      assert.equal(daily.dateISO, "2026-02-15");
      assert.equal(daily.prayers.fajr.toFormat("HH:mm"), "05:00");
      assert.equal(daily.prayers.isha.toFormat("HH:mm"), "19:45");

      const now = DateTime.fromISO("2026-02-15T12:30:00Z", { zone: "UTC" });
      const next = await getNextPrayer(location, now);
      assert.equal(next.prayerKey, "dhuhr");
      assert.equal(next.time.toFormat("HH:mm"), "13:00");
    }
  );
});
