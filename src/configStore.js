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

const DEFAULT_GUILD_CONFIG = {
  location: null,
  reminderChannelId: null,
  adhanVoiceChannelId: null,
  playAdhanInVoice: false,
  mentionRoleId: null,
  language: "english",
  lastTriggered: {},
  prePrayerRemindersEnabled: false,
  prePrayerLeadMinutes: DEFAULT_PRE_PRAYER_LEAD_MINUTES,
  prePrayerSelections: structuredClone(DEFAULT_PRE_PRAYER_SELECTIONS),
  prePrayerLastTriggered: {},
  azkarRemindersEnabled: false,
  azkarIntervalMinutes: 180,
  azkarLanguage: "english",
  azkarLastSentAt: null,
  hadithRemindersEnabled: false,
  hadithReminderTime: "20:00",
  hadithMinGrade: "sahih",
  hadithLanguage: "english",
  hadithLastTriggeredDate: null,
  recentAzkarIds: [],
  recentHadithIds: []
};

function normalizeGuildConfig(config) {
  const normalized = {
    ...structuredClone(DEFAULT_GUILD_CONFIG),
    ...config
  };
  normalized.language = normalizeLanguageValue(config?.language || config?.azkarLanguage || config?.hadithLanguage);
  normalized.azkarLanguage = normalizeLanguageValue(config?.azkarLanguage || normalized.language);
  normalized.hadithLanguage = normalizeLanguageValue(config?.hadithLanguage || normalized.language);
  normalized.prePrayerLeadMinutes = normalizePrePrayerLeadMinutes(config?.prePrayerLeadMinutes);
  normalized.prePrayerSelections = normalizePrePrayerSelections(config?.prePrayerSelections);
  normalized.prePrayerLastTriggered = { ...(config?.prePrayerLastTriggered || {}) };
  normalized.lastTriggered = { ...(config?.lastTriggered || {}) };
  normalized.recentAzkarIds = Array.isArray(config?.recentAzkarIds) ? [...config.recentAzkarIds] : [];
  normalized.recentHadithIds = Array.isArray(config?.recentHadithIds) ? [...config.recentHadithIds] : [];
  return normalized;
}

class ConfigStore {
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

  getGuildConfig(guildId) {
    this.load();
    const current = this.data[guildId];
    if (!current) {
      this.data[guildId] = structuredClone(DEFAULT_GUILD_CONFIG);
      this.save();
      return this.data[guildId];
    }

    const normalized = normalizeGuildConfig(current);
    if (JSON.stringify(normalized) !== JSON.stringify(current)) {
      this.data[guildId] = normalized;
      this.save();
    }
    return this.data[guildId];
  }

  updateGuildConfig(guildId, updater) {
    this.load();
    const current = this.getGuildConfig(guildId);
    const updated = updater(structuredClone(current));
    this.data[guildId] = updated;
    this.save();
    return updated;
  }

  deleteGuildConfig(guildId) {
    this.load();
    if (!Object.hasOwn(this.data, guildId)) {
      return false;
    }
    delete this.data[guildId];
    this.save();
    return true;
  }

  getAllConfigs() {
    this.load();
    let changed = false;
    for (const [guildId, config] of Object.entries(this.data)) {
      const normalized = normalizeGuildConfig(config);
      if (JSON.stringify(normalized) !== JSON.stringify(config)) {
        this.data[guildId] = normalized;
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
  ConfigStore,
  DEFAULT_GUILD_CONFIG
};
