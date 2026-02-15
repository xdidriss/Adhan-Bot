const fs = require("node:fs");
const path = require("node:path");
const { getEncryptionKeyFromEnv, parseJsonFileContents, stringifyJsonForFile } = require("./dataCipher");

function normalizeLanguageValue(value) {
  return String(value || "english").trim().toLowerCase() === "arabic" ? "arabic" : "english";
}

const PRE_PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRE_PRAYER_LEAD_CHOICES = new Set([5, 10, 15]);
const DEFAULT_PRE_PRAYER_SELECTIONS = Object.freeze({
  fajr: true,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true
});
const DEFAULT_PRE_PRAYER_LEAD_MINUTES = 10;

function normalizePrePrayerLeadMinutes(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PRE_PRAYER_LEAD_MINUTES;
  }
  return PRE_PRAYER_LEAD_CHOICES.has(parsed) ? parsed : DEFAULT_PRE_PRAYER_LEAD_MINUTES;
}

function normalizePrePrayerSelections(value) {
  const raw = value && typeof value === "object" ? value : {};
  const normalized = {};
  for (const key of PRE_PRAYER_KEYS) {
    normalized[key] = raw[key] !== false;
  }
  return normalized;
}

const DEFAULT_USER_CONFIG = {
  location: null,
  dmRemindersEnabled: false,
  language: "english",
  lastTriggered: {},
  dmPrePrayerRemindersEnabled: false,
  dmPrePrayerLeadMinutes: DEFAULT_PRE_PRAYER_LEAD_MINUTES,
  dmPrePrayerSelections: structuredClone(DEFAULT_PRE_PRAYER_SELECTIONS),
  dmPrePrayerLastTriggered: {},
  dmAzkarRemindersEnabled: false,
  dmAzkarIntervalMinutes: 180,
  dmAzkarLanguage: "english",
  dmAzkarLastSentAt: null,
  dmHadithRemindersEnabled: false,
  dmHadithReminderTime: "20:00",
  dmHadithMinGrade: "sahih",
  dmHadithLanguage: "english",
  dmHadithLastTriggeredDate: null,
  recentAzkarIds: [],
  recentHadithIds: []
};

function normalizeUserConfig(config) {
  const normalized = {
    ...structuredClone(DEFAULT_USER_CONFIG),
    ...config
  };
  normalized.language = normalizeLanguageValue(config?.language || config?.dmAzkarLanguage || config?.dmHadithLanguage);
  normalized.dmAzkarLanguage = normalizeLanguageValue(config?.dmAzkarLanguage || normalized.language);
  normalized.dmHadithLanguage = normalizeLanguageValue(config?.dmHadithLanguage || normalized.language);
  normalized.dmPrePrayerLeadMinutes = normalizePrePrayerLeadMinutes(config?.dmPrePrayerLeadMinutes);
  normalized.dmPrePrayerSelections = normalizePrePrayerSelections(config?.dmPrePrayerSelections);
  normalized.dmPrePrayerLastTriggered = { ...(config?.dmPrePrayerLastTriggered || {}) };
  normalized.lastTriggered = { ...(config?.lastTriggered || {}) };
  normalized.recentAzkarIds = Array.isArray(config?.recentAzkarIds) ? [...config.recentAzkarIds] : [];
  normalized.recentHadithIds = Array.isArray(config?.recentHadithIds) ? [...config.recentHadithIds] : [];
  return normalized;
}

class UserConfigStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this.loaded = false;
    this.encryptionKey = getEncryptionKeyFromEnv();
  }

  ensureDirectory() {
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  load() {
    if (this.loaded) {
      return;
    }

    this.ensureDirectory();
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, stringifyJsonForFile({}, { key: this.encryptionKey }), "utf8");
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    this.data = parseJsonFileContents(raw, { key: this.encryptionKey });
    this.loaded = true;
  }

  save() {
    this.ensureDirectory();
    fs.writeFileSync(this.filePath, stringifyJsonForFile(this.data, { key: this.encryptionKey }), "utf8");
  }

  getUserConfig(userId) {
    this.load();
    const current = this.data[userId];
    if (!current) {
      this.data[userId] = structuredClone(DEFAULT_USER_CONFIG);
      this.save();
      return this.data[userId];
    }

    const normalized = normalizeUserConfig(current);
    if (JSON.stringify(normalized) !== JSON.stringify(current)) {
      this.data[userId] = normalized;
      this.save();
    }
    return this.data[userId];
  }

  updateUserConfig(userId, updater) {
    this.load();
    const current = this.getUserConfig(userId);
    const updated = updater(structuredClone(current));
    this.data[userId] = updated;
    this.save();
    return updated;
  }

  deleteUserConfig(userId) {
    this.load();
    if (!Object.hasOwn(this.data, userId)) {
      return false;
    }
    delete this.data[userId];
    this.save();
    return true;
  }

  getAllConfigs() {
    this.load();
    let changed = false;
    for (const [userId, config] of Object.entries(this.data)) {
      const normalized = normalizeUserConfig(config);
      if (JSON.stringify(normalized) !== JSON.stringify(config)) {
        this.data[userId] = normalized;
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
    return this.data;
  }
}

module.exports = {
  DEFAULT_USER_CONFIG,
  UserConfigStore
};
