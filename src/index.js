require("dotenv").config();

const { AsyncLocalStorage } = require("node:async_hooks");
const path = require("node:path");
const { Client, GatewayIntentBits, MessageFlags, PermissionsBitField } = require("discord.js");
const { DateTime } = require("luxon");

const { playAdhanInVoice } = require("./adhanVoice");
const { ConfigStore } = require("./configStore");
const { COUNTRY_NAMES } = require("./countries");
const { startDashboardServer } = require("./dashboardServer");
const {
  CONTENT_LANGUAGE_LABELS,
  HADITH_GRADE_LABELS,
  getEntryTextByLanguage,
  getRandomAzkar,
  getRandomHadith,
  normalizeContentLanguage,
  normalizeHadithGrade
} = require("./islamicContentService");
const {
  PRAYER_LABELS,
  PRAYER_LABELS_ARABIC,
  PRAYER_ORDER,
  getNextPrayer,
  getPrayerTimesForDate,
  resolveCityCountryLocation
} = require("./prayerTimesService");
const { UserConfigStore } = require("./userConfigStore");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

const checkIntervalSeconds = Number(process.env.CHECK_INTERVAL_SECONDS || 20);
const CHECK_INTERVAL_MS = Math.max(10, checkIntervalSeconds) * 1000;
const ADHAN_AUDIO_FILE =
  process.env.ADHAN_AUDIO_FILE || path.join(__dirname, "..", "assets", "adhan.mp3");

const DEFAULT_AZKAR_INTERVAL_MINUTES = 180;
const DEFAULT_HADITH_TIME = "20:00";
const DEFAULT_PRE_PRAYER_LEAD_MINUTES = 10;
const PRE_PRAYER_LEAD_CHOICES = [5, 10, 15];
const RECENT_CONTENT_HISTORY_SIZE = 12;

const ICONS = {
  adhan: "\u{1F54C}",
  warning: "\u26A0\uFE0F",
  clock: "\u{1F552}",
  globe: "\u{1F30D}",
  pin: "\u{1F4CD}",
  ruler: "\u{1F4D0}",
  balance: "\u2696\uFE0F",
  megaphone: "\u{1F4E3}",
  speaker: "\u{1F50A}",
  headset: "\u{1F3A7}",
  people: "\u{1F465}",
  mail: "\u{1F4E9}",
  note: "\u{1F4DD}",
  moon: "\u{1F319}",
  hourglass: "\u23F3",
  test: "\u{1F9EA}",
  home: "\u{1F3E0}",
  compass: "\u{1F9ED}",
  book: "\u{1F4D6}",
  sparkle: "\u2728",
  loop: "\u{1F501}",
  hands: "\u{1F64F}",
  loud: "\u{1F50A}",
  mailbox: "\u{1F4EC}",
  chart: "\u{1F4CA}",
  check: "\u2705"
};

const guildStore = new ConfigStore(path.join(__dirname, "..", "data", "guildConfigs.json"));
const userStore = new UserConfigStore(path.join(__dirname, "..", "data", "userConfigs.json"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

startDashboardServer({
  client,
  guildStore,
  userStore
});

const GUILD_ONLY_COMMANDS = new Set([
  "set-location",
  "set-channels",
  "set-mention-role",
  "set-azkar-reminders",
  "set-hadith-reminders",
  "delete-guild-data",
  "config",
  "prayer-times",
  "next-prayer",
  "test-adhan",
  "test-azkar",
  "test-hadith"
]);

const USER_COMMANDS = new Set([
  "my-location",
  "dm-reminders",
  "dm-azkar-reminders",
  "dm-hadith-reminders",
  "dm-config",
  "dm-test",
  "dm-test-azkar",
  "dm-test-hadith",
  "dm-prayer-times",
  "dm-next-prayer",
  "export-my-data",
  "delete-my-data"
]);

const PRAYER_EMOJIS = {
  fajr: "\u{1F305}",
  dhuhr: "\u2600\uFE0F",
  asr: "\u{1F324}\uFE0F",
  maghrib: "\u{1F307}",
  isha: "\u{1F319}"
};

const PRAYER_UI_TEXT = {
  english: {
    adhanTitle: "Adhan Reminder",
    prePrayerTitle: "Pre-Prayer Reminder",
    testAdhanTitle: "Test Adhan Reminder",
    prayerTimesTitle: "Prayer Times",
    nextPrayerTitle: "Next Prayer",
    prayerLabel: "Prayer",
    adhanTimeLabel: "Adhan Time",
    startsInLabel: "Starts in",
    timeLabel: "Time",
    timezoneLabel: "Timezone",
    discordTimeLabel: "Discord Time",
    startsLabel: "Starts",
    prepareLine: "_Prepare for salah._",
    acceptanceLine: "_May Allah accept your salah._"
  },
  arabic: {
    prePrayerTitle: "\u062a\u0630\u0643\u064a\u0631 \u0642\u0628\u0644 \u0627\u0644\u0635\u0644\u0627\u0629",
    adhanTitle: "تذكير الأذان",
    testAdhanTitle: "تجربة تذكير الأذان",
    prayerTimesTitle: "مواقيت الصلاة",
    nextPrayerTitle: "الصلاة القادمة",
    prayerLabel: "الصلاة",
    adhanTimeLabel: "\u0648\u0642\u062a \u0627\u0644\u0623\u0630\u0627\u0646",
    startsInLabel: "\u064a\u0628\u062f\u0623 \u0628\u0639\u062f",
    timeLabel: "الوقت",
    timezoneLabel: "المنطقة الزمنية",
    discordTimeLabel: "وقت ديسكورد",
    startsLabel: "تبدأ",
    prepareLine: "_\u0627\u0633\u062a\u0639\u062f \u0644\u0644\u0635\u0644\u0627\u0629._",
    acceptanceLine: "_تقبل الله صلاتكم._"
  }
};

const ARABIC_TEXT_REPLACEMENTS = [
  { pattern: /Action Needed/g, replacement: "إجراء مطلوب" },
  { pattern: /Internal Error/g, replacement: "خطأ داخلي" },
  { pattern: /Server Command/g, replacement: "أمر خاص بالسيرفر" },
  { pattern: /Server Adhan Configuration/g, replacement: "إعدادات الأذان في السيرفر" },
  { pattern: /Personal DM Configuration/g, replacement: "إعدادات الرسائل الخاصة" },
  { pattern: /Server Location Updated/g, replacement: "تم تحديث موقع السيرفر" },
  { pattern: /Personal Location Updated/g, replacement: "تم تحديث موقعك الشخصي" },
  { pattern: /Channel Settings Updated/g, replacement: "تم تحديث إعدادات القنوات" },
  { pattern: /Mention Role Updated/g, replacement: "تم تحديث رتبة المنشن" },
  { pattern: /Azkar Reminder/g, replacement: "تذكير أذكار" },
  { pattern: /Test Azkar Reminder/g, replacement: "تجربة تذكير أذكار" },
  { pattern: /Hadith Reminder/g, replacement: "تذكير حديث" },
        { pattern: /Pre-Prayer Reminder/g, replacement: "\u062a\u0630\u0643\u064a\u0631 \u0642\u0628\u0644 \u0627\u0644\u0635\u0644\u0627\u0629" },
  { pattern: /Azkar Reminders Enabled/g, replacement: "\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u062a\u0630\u0643\u064a\u0631\u0627\u062a \u0627\u0644\u0623\u0630\u0643\u0627\u0631" },
  { pattern: /Azkar Reminders Disabled/g, replacement: "تم إيقاف تذكيرات الأذكار" },
  { pattern: /Hadith Reminders Enabled/g, replacement: "تم تفعيل تذكيرات الحديث" },
  { pattern: /Hadith Reminders Disabled/g, replacement: "تم إيقاف تذكيرات الحديث" },
  { pattern: /DM Prayer Reminders Enabled/g, replacement: "تم تفعيل تذكيرات الصلاة في الخاص" },
  { pattern: /Pre-Prayer Reminders:/g, replacement: "\u062a\u0630\u0643\u064a\u0631\u0627\u062a \u0642\u0628\u0644 \u0627\u0644\u0635\u0644\u0627\u0629:" },
  { pattern: /Lead Time:/g, replacement: "\u0648\u0642\u062a \u0627\u0644\u062a\u0646\u0628\u064a\u0647:" },
  { pattern: /Prayers:/g, replacement: "\u0627\u0644\u0635\u0644\u0648\u0627\u062a:" },
  { pattern: /minutes before/g, replacement: "\u062f\u0642\u0627\u0626\u0642 \u0642\u0628\u0644" },
  { pattern: /DM Azkar Enabled/g, replacement: "\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0623\u0630\u0643\u0627\u0631 \u0627\u0644\u062e\u0627\u0635" },
  { pattern: /DM Azkar Disabled/g, replacement: "تم إيقاف أذكار الخاص" },
  { pattern: /DM Hadith Enabled/g, replacement: "تم تفعيل أحاديث الخاص" },
  { pattern: /DM Hadith Disabled/g, replacement: "تم إيقاف أحاديث الخاص" },
  { pattern: /Test Reminder Sent/g, replacement: "تم إرسال التذكير التجريبي" },
  { pattern: /Test Azkar Sent/g, replacement: "تم إرسال أذكار تجريبية" },
  { pattern: /Test Hadith Sent/g, replacement: "تم إرسال حديث تجريبي" },
  { pattern: /Test DM Sent/g, replacement: "تم إرسال رسالة خاصة تجريبية" },
  { pattern: /Test Azkar DM Sent/g, replacement: "تم إرسال أذكار تجريبية في الخاص" },
  { pattern: /Test Hadith DM Sent/g, replacement: "تم إرسال حديث تجريبي في الخاص" },
  { pattern: /Location:/g, replacement: "الموقع:" },
  { pattern: /City:/g, replacement: "المدينة:" },
  { pattern: /Country:/g, replacement: "الدولة:" },
  { pattern: /Timezone:/g, replacement: "المنطقة الزمنية:" },
  { pattern: /Method:/g, replacement: "طريقة الحساب:" },
  { pattern: /School:/g, replacement: "المذهب:" },
  { pattern: /Reminder Channel:/g, replacement: "قناة التذكير:" },
  { pattern: /Voice Channel:/g, replacement: "القناة الصوتية:" },
  { pattern: /Voice Playback:/g, replacement: "تشغيل الصوت:" },
  { pattern: /Mention Role:/g, replacement: "رتبة المنشن:" },
  { pattern: /Global Language:/g, replacement: "اللغة العامة:" },
  { pattern: /Azkar Reminders:/g, replacement: "تذكيرات الأذكار:" },
  { pattern: /Azkar Interval:/g, replacement: "فاصل الأذكار:" },
  { pattern: /Last Azkar Sent:/g, replacement: "آخر إرسال للأذكار:" },
  { pattern: /Hadith Reminders:/g, replacement: "تذكيرات الحديث:" },
  { pattern: /Hadith Time:/g, replacement: "وقت الحديث:" },
  { pattern: /Hadith Grade Filter:/g, replacement: "فلتر درجة الحديث:" },
  { pattern: /Status:/g, replacement: "الحالة:" },
  { pattern: /Interval:/g, replacement: "الفاصل:" },
  { pattern: /Time:/g, replacement: "الوقت:" },
  { pattern: /Language:/g, replacement: "اللغة:" },
  { pattern: /Dhikr:/g, replacement: "الذكر:" },
  { pattern: /Text:/g, replacement: "النص:" },
  { pattern: /Source:/g, replacement: "المصدر:" },
  { pattern: /Role:/g, replacement: "الرتبة:" },
  { pattern: /Grade Filter:/g, replacement: "فلتر الدرجة:" },
  { pattern: /Scheduled prayer time:/g, replacement: "\u0645\u0648\u0639\u062f \u0627\u0644\u0635\u0644\u0627\u0629 \u0627\u0644\u0645\u062d\u062f\u062f:" },
  { pattern: /Adhan Time:/g, replacement: "\u0648\u0642\u062a \u0627\u0644\u0623\u0630\u0627\u0646:" },
  { pattern: /Starts in:/g, replacement: "\u064a\u0628\u062f\u0623 \u0628\u0639\u062f:" },
  { pattern: /Prepare for salah\\./g, replacement: "\u0627\u0633\u062a\u0639\u062f \u0644\u0644\u0635\u0644\u0627\u0629." },
  { pattern: /Voice playback started\\./g, replacement: "\u0628\u062f\u0623 \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0635\u0648\u062a." },
  { pattern: /Voice playback failed:/g, replacement: "فشل تشغيل الصوت:" },
  { pattern: /Voice playback skipped\./g, replacement: "تم تخطي تشغيل الصوت." },
  { pattern: /This command can only be used inside a server\./g, replacement: "هذا الأمر يعمل فقط داخل السيرفر." },
  { pattern: /You need Manage Server permission to use this command\./g, replacement: "تحتاج صلاحية إدارة السيرفر لاستخدام هذا الأمر." },
  { pattern: /City must be at least 2 characters\./g, replacement: "يجب أن يكون اسم المدينة حرفين على الأقل." },
  { pattern: /Country is required\./g, replacement: "الدولة مطلوبة." },
  { pattern: /Could not resolve that city\/country:/g, replacement: "تعذر تحديد هذه المدينة/الدولة:" },
  { pattern: /Reminder channel is not configured\. Use \/set-channels first\./g, replacement: "قناة التذكير غير مضبوطة. استخدم /set-channels أولاً." },
  { pattern: /Location is not configured\. Use \/set-location first\./g, replacement: "الموقع غير مضبوط. استخدم /set-location أولاً." },
  { pattern: /Location is not configured\. Use \/my-location first\./g, replacement: "الموقع غير مضبوط. استخدم /my-location أولاً." },
  { pattern: /Voice playback is enabled but no voice channel is configured\./g, replacement: "تشغيل الصوت مفعّل ولكن لم يتم تحديد قناة صوتية." },
  { pattern: /Invalid date format\. Use YYYY-MM-DD\./g, replacement: "تنسيق التاريخ غير صحيح. استخدم YYYY-MM-DD." },
  { pattern: /Could not parse that date\. Use YYYY-MM-DD\./g, replacement: "تعذر قراءة هذا التاريخ. استخدم YYYY-MM-DD." },
  { pattern: /Set your location first with \/my-location before enabling DM reminders\./g, replacement: "اضبط موقعك أولاً باستخدام /my-location قبل تفعيل تذكيرات الخاص." },
  { pattern: /Set your location first with \/my-location before enabling DM azkar reminders\./g, replacement: "اضبط موقعك أولاً باستخدام /my-location قبل تفعيل أذكار الخاص." },
  { pattern: /Set your location first with \/my-location before enabling DM hadith reminders\./g, replacement: "اضبط موقعك أولاً باستخدام /my-location قبل تفعيل أحاديث الخاص." },
  { pattern: /Random azkar reminder sent to the configured reminder channel\./g, replacement: "تم إرسال تذكير أذكار عشوائي إلى قناة التذكير المحددة." },
  { pattern: /Random hadith reminder sent to the configured reminder channel\./g, replacement: "تم إرسال حديث عشوائي إلى قناة التذكير المحددة." },
  { pattern: /Check your direct messages for the sample reminder\./g, replacement: "تحقق من الرسائل الخاصة للاطلاع على التذكير التجريبي." },
  { pattern: /Check your direct messages for the random azkar\./g, replacement: "تحقق من الرسائل الخاصة للأذكار العشوائية." },
  { pattern: /Check your direct messages for the random hadith\./g, replacement: "تحقق من الرسائل الخاصة للحديث العشوائي." },
  { pattern: /DM reminders will use this location\./g, replacement: "سيتم استخدام هذا الموقع لتذكيرات الخاص." },
  { pattern: /Prayer timings will now use this location\./g, replacement: "سيتم استخدام هذا الموقع لمواقيت الصلاة." },
  { pattern: /Test message delivered to the configured reminder channel\./g, replacement: "تم إرسال الرسالة التجريبية إلى قناة التذكير المحددة." },
  { pattern: /Test failed:/g, replacement: "فشل الاختبار:" },
  { pattern: /The command failed due to an internal error\./g, replacement: "فشل تنفيذ الأمر بسبب خطأ داخلي." },
  { pattern: /Please try again in a moment\./g, replacement: "يرجى المحاولة مرة أخرى بعد قليل." },
  { pattern: /Not set/g, replacement: "غير مضبوط" },
  { pattern: /\bNone\b/g, replacement: "لا يوجد" },
  { pattern: /\bNever\b/g, replacement: "أبداً" },
  { pattern: /\bEnglish\b/g, replacement: "الإنجليزية" },
  { pattern: /\bArabic\b/g, replacement: "العربية" },
  { pattern: /\bSahih\b/g, replacement: "صحيح" },
  { pattern: /\bHasan\b/g, replacement: "حسن" },
  { pattern: /\bWeak\b/g, replacement: "ضعيف" },
  { pattern: /\bEnabled\b/g, replacement: "مفعّل" },
  { pattern: /\bDisabled\b/g, replacement: "معطّل" },
  { pattern: /\bEvery\b/g, replacement: "كل" },
  { pattern: /\bminutes\b/g, replacement: "دقيقة" }
];

const languageContext = new AsyncLocalStorage();

let isRunningCheck = false;

function normalizeDisplayText(content) {
  return typeof content === "string" ? content : "";
}

function getCurrentContextLanguage() {
  const store = languageContext.getStore();
  if (!store || typeof store !== "object") {
    return "english";
  }
  return normalizeContentLanguage(store.language);
}

function localizeText(content, language) {
  const normalizedLanguage = normalizeContentLanguage(language);
  const normalizedContent = normalizeDisplayText(content);
  if (normalizedLanguage !== "arabic" || normalizedContent.length === 0) {
    return normalizedContent;
  }

  let localized = normalizedContent;
  for (const { pattern, replacement } of ARABIC_TEXT_REPLACEMENTS) {
    localized = localized.replace(pattern, replacement);
  }
  return localized;
}

function userCanManageGuild(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild);
}

function hasValidLocation(config) {
  const location = config?.location;
  return (
    location &&
    typeof location.timezone === "string" &&
    location.timezone.trim().length > 0 &&
    (
      (typeof location.city === "string" &&
        location.city.trim().length > 0 &&
        typeof location.country === "string" &&
        location.country.trim().length > 0) ||
      (typeof location.latitude === "number" && typeof location.longitude === "number")
    )
  );
}

function validateCityCountryInput(city, country) {
  if (!city || city.trim().length < 2) {
    return "City must be at least 2 characters.";
  }

  if (!country || country.trim().length < 2) {
    return "Country is required.";
  }

  return null;
}

function sanitizeIntervalMinutes(interval) {
  const parsed = Number(interval);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_AZKAR_INTERVAL_MINUTES;
  }
  return Math.min(1440, Math.max(30, Math.round(parsed)));
}

function sanitizePrePrayerLeadMinutes(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PRE_PRAYER_LEAD_MINUTES;
  }
  return PRE_PRAYER_LEAD_CHOICES.includes(parsed) ? parsed : DEFAULT_PRE_PRAYER_LEAD_MINUTES;
}

function normalizePrePrayerSelections(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    fajr: raw.fajr !== false,
    dhuhr: raw.dhuhr !== false,
    asr: raw.asr !== false,
    maghrib: raw.maghrib !== false,
    isha: raw.isha !== false
  };
}

function selectedPrayerKeysFromMap(value) {
  const normalized = normalizePrePrayerSelections(value);
  return PRAYER_ORDER.filter((prayerKey) => normalized[prayerKey]);
}

function normalizeReminderTime(timeValue) {
  if (typeof timeValue === "string" && /^\d{2}:\d{2}$/.test(timeValue)) {
    return timeValue;
  }
  return DEFAULT_HADITH_TIME;
}

function getContentLanguageLabel(language) {
  const normalizedLanguage = normalizeContentLanguage(language);
  return CONTENT_LANGUAGE_LABELS[normalizedLanguage] || "English";
}

function resolveConfigLanguage(config, { dm = false } = {}) {
  if (!config || typeof config !== "object") {
    return "english";
  }
  const explicit = dm
    ? config.language || config.dmAzkarLanguage || config.dmHadithLanguage
    : config.language || config.azkarLanguage || config.hadithLanguage;
  return normalizeContentLanguage(explicit);
}

function getPrayerUiText(language) {
  return PRAYER_UI_TEXT[normalizeContentLanguage(language)] || PRAYER_UI_TEXT.english;
}

function getPrayerDisplayLabel(prayerKey, language) {
  const normalizedLanguage = normalizeContentLanguage(language);
  const englishLabel = PRAYER_LABELS[prayerKey] || prayerKey;
  const arabicLabel = PRAYER_LABELS_ARABIC[prayerKey] || englishLabel;
  return normalizedLanguage === "arabic" ? arabicLabel : englishLabel;
}

function buildReminderTime({ hour, minute, fallback = DEFAULT_HADITH_TIME }) {
  const [fallbackHour, fallbackMinute] = normalizeReminderTime(fallback).split(":").map(Number);
  const targetHour = Number.isInteger(hour) ? hour : fallbackHour;
  const targetMinute = Number.isInteger(minute) ? minute : fallbackMinute;
  return `${String(targetHour).padStart(2, "0")}:${String(targetMinute).padStart(2, "0")}`;
}

function toSafeIso(value, zone) {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value, { zone });
  return parsed.isValid ? parsed : null;
}

function getPrayerEmoji(prayerKey) {
  return PRAYER_EMOJIS[prayerKey] || ICONS.adhan;
}

function styledBlock({ icon = ICONS.adhan, title, lines = [], language }) {
  const resolvedLanguage = normalizeContentLanguage(language || getCurrentContextLanguage());
  const localizedTitle = localizeText(title, resolvedLanguage);
  const localizedLines = lines.filter(Boolean).map((line) => localizeText(line, resolvedLanguage));
  const body = [normalizeDisplayText(`${icon} **${localizedTitle}**`), ...localizedLines];
  return normalizeDisplayText(body.join("\n"));
}

function styledError(message, language) {
  const resolvedLanguage = normalizeContentLanguage(language || getCurrentContextLanguage());
  return styledBlock({
    icon: ICONS.warning,
    title: "Action Needed",
    lines: [`${ICONS.warning} ${message}`],
    language: resolvedLanguage
  });
}

function formatLocationLines(location, { language = "english" } = {}) {
  const resolvedLanguage = normalizeContentLanguage(language);
  if (!location) {
    return [localizeText(`${ICONS.globe} **Location:** Not set`, resolvedLanguage)];
  }

  if (typeof location.city === "string" && typeof location.country === "string") {
    return [
      localizeText(`${ICONS.globe} **City:** ${location.city}`, resolvedLanguage),
      localizeText(`${ICONS.globe} **Country:** ${location.country}`, resolvedLanguage),
      localizeText(`${ICONS.clock} **Timezone:** ${location.timezone}`, resolvedLanguage),
      localizeText(`${ICONS.ruler} **Method:** ${location.method}`, resolvedLanguage),
      localizeText(`${ICONS.balance} **School:** ${location.school}`, resolvedLanguage)
    ];
  }

  return [
    localizeText(`${ICONS.pin} **Latitude:** ${location.latitude}`, resolvedLanguage),
    localizeText(`${ICONS.pin} **Longitude:** ${location.longitude}`, resolvedLanguage),
    localizeText(`${ICONS.clock} **Timezone:** ${location.timezone}`, resolvedLanguage),
    localizeText(`${ICONS.ruler} **Method:** ${location.method}`, resolvedLanguage),
    localizeText(`${ICONS.balance} **School:** ${location.school}`, resolvedLanguage)
  ];
}

function getCountrySuggestions(focused) {
  const query = focused.trim().toLowerCase();
  if (!query) {
    return COUNTRY_NAMES.slice(0, 25);
  }

  const startsWithMatches = COUNTRY_NAMES.filter((name) => name.toLowerCase().startsWith(query));
  const containsMatches = COUNTRY_NAMES.filter(
    (name) => !name.toLowerCase().startsWith(query) && name.toLowerCase().includes(query)
  );
  return [...startsWithMatches, ...containsMatches].slice(0, 25);
}

async function handleAutocompleteInteraction(interaction) {
  const commandName = interaction.commandName;
  if (commandName !== "set-location" && commandName !== "my-location") {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused(true);
  if (focused.name !== "country") {
    await interaction.respond([]);
    return;
  }

  const suggestions = getCountrySuggestions(String(focused.value || ""));
  await interaction.respond(
    suggestions.map((country) => ({
      name: country,
      value: country
    }))
  );
}

function formatPrePrayerSettingsLines(config, { dm = false } = {}) {
  const language = resolveConfigLanguage(config, { dm });
  const enabled = dm ? config.dmPrePrayerRemindersEnabled : config.prePrayerRemindersEnabled;
  const leadMinutes = sanitizePrePrayerLeadMinutes(dm ? config.dmPrePrayerLeadMinutes : config.prePrayerLeadMinutes);
  const selectedPrayerKeys = selectedPrayerKeysFromMap(dm ? config.dmPrePrayerSelections : config.prePrayerSelections);
  const selectedPrayerLabel = selectedPrayerKeys.length
    ? selectedPrayerKeys
        .map((prayerKey) => `${getPrayerEmoji(prayerKey)} ${getPrayerDisplayLabel(prayerKey, language)}`)
        .join(", ")
    : localizeText("None", language);

  return [
    localizeText(`${ICONS.clock} **Pre-Prayer Reminders:** ${enabled ? "Enabled" : "Disabled"}`, language),
    localizeText(`${ICONS.hourglass} **Lead Time:** ${leadMinutes} minutes before`, language),
    localizeText(`${ICONS.adhan} **Prayers:** ${selectedPrayerLabel}`, language)
  ];
}

function formatAzkarSettingsLines(config, { dm = false } = {}) {
  const language = resolveConfigLanguage(config, { dm });
  const enabled = dm ? config.dmAzkarRemindersEnabled : config.azkarRemindersEnabled;
  const interval = sanitizeIntervalMinutes(dm ? config.dmAzkarIntervalMinutes : config.azkarIntervalMinutes);
  const lastSentRaw = dm ? config.dmAzkarLastSentAt : config.azkarLastSentAt;
  const zone = config.location?.timezone || "UTC";
  const parsedLastSent = toSafeIso(lastSentRaw, zone);
  const lastSentLabel = parsedLastSent ? parsedLastSent.toFormat("yyyy-LL-dd HH:mm") : "Never";
  return [
    localizeText(`${ICONS.loop} **Azkar Reminders:** ${enabled ? "Enabled" : "Disabled"}`, language),
    localizeText(`${ICONS.clock} **Azkar Interval:** Every ${interval} minutes`, language),
    localizeText(`${ICONS.note} **Last Azkar Sent:** ${lastSentLabel}`, language)
  ];
}

function formatHadithSettingsLines(config, { dm = false } = {}) {
  const language = resolveConfigLanguage(config, { dm });
  const enabled = dm ? config.dmHadithRemindersEnabled : config.hadithRemindersEnabled;
  const time = normalizeReminderTime(dm ? config.dmHadithReminderTime : config.hadithReminderTime);
  const minGrade = normalizeHadithGrade(dm ? config.dmHadithMinGrade : config.hadithMinGrade);
  const gradeLabel = HADITH_GRADE_LABELS[minGrade] || minGrade;
  return [
    localizeText(`${ICONS.book} **Hadith Reminders:** ${enabled ? "Enabled" : "Disabled"}`, language),
    localizeText(`${ICONS.clock} **Hadith Time:** ${time} (${config.location?.timezone || "UTC"})`, language),
    localizeText(`${ICONS.chart} **Hadith Grade Filter:** ${gradeLabel}`, language)
  ];
}

function formatGuildConfig(config) {
  const reminderChannel = config.reminderChannelId ? `<#${config.reminderChannelId}>` : "Not set";
  const voiceChannel = config.adhanVoiceChannelId ? `<#${config.adhanVoiceChannelId}>` : "Not set";
  const mentionRole = config.mentionRoleId ? `<@&${config.mentionRoleId}>` : "None";
  const language = resolveConfigLanguage(config);

  return styledBlock({
    icon: ICONS.adhan,
    title: "Server Adhan Configuration",
    lines: [
      ...formatLocationLines(config.location, { language }),
      localizeText(`${ICONS.megaphone} **Reminder Channel:** ${reminderChannel}`, language),
      localizeText(`${ICONS.speaker} **Voice Channel:** ${voiceChannel}`, language),
      localizeText(`${ICONS.headset} **Voice Playback:** ${config.playAdhanInVoice ? "Enabled" : "Disabled"}`, language),
      localizeText(`${ICONS.people} **Mention Role:** ${mentionRole}`, language),
      localizeText(`${ICONS.book} **Global Language:** ${getContentLanguageLabel(language)}`, language),
      ...formatPrePrayerSettingsLines(config),
      ...formatAzkarSettingsLines(config),
      ...formatHadithSettingsLines(config)
    ],
    language
  });
}

function formatUserConfig(config) {
  const language = resolveConfigLanguage(config, { dm: true });
  return styledBlock({
    icon: ICONS.hands,
    title: "Personal DM Configuration",
    lines: [
      localizeText(`${ICONS.mail} **DM Prayer Reminders:** ${config.dmRemindersEnabled ? "Enabled" : "Disabled"}`, language),
      localizeText(`${ICONS.book} **Global Language:** ${getContentLanguageLabel(language)}`, language),
      ...formatPrePrayerSettingsLines(config, { dm: true }),
      ...formatAzkarSettingsLines(config, { dm: true }),
      ...formatHadithSettingsLines(config, { dm: true }),
      ...formatLocationLines(config.location, { language })
    ],
    language
  });
}

function formatPrayerLines(prayers, { language = "english" } = {}) {
  return PRAYER_ORDER.map((prayerKey) => {
    const label = getPrayerDisplayLabel(prayerKey, language);
    return `${getPrayerEmoji(prayerKey)} **${label}:** ${prayers[prayerKey].toFormat("HH:mm")}`;
  }).join("\n");
}

async function getTestPrayerSchedule(location, selectedPrayerKey) {
  const nowInZone = DateTime.now().setZone(location.timezone);
  const daily = await getPrayerTimesForDate(location, nowInZone);
  const todayTime = daily.prayers[selectedPrayerKey];

  if (todayTime > nowInZone) {
    return {
      prayerKey: selectedPrayerKey,
      prayerTime: todayTime
    };
  }

  const tomorrow = await getPrayerTimesForDate(location, nowInZone.plus({ days: 1 }));
  return {
    prayerKey: selectedPrayerKey,
    prayerTime: tomorrow.prayers[selectedPrayerKey]
  };
}

function privateResponseOptions(interaction, content) {
  const normalized = normalizeDisplayText(content);
  return interaction.inGuild() ? { content: normalized, flags: MessageFlags.Ephemeral } : { content: normalized };
}

function errorResponseOptions(interaction, language = "english") {
  return privateResponseOptions(
    interaction,
    styledBlock({
      icon: ICONS.warning,
      title: "Internal Error",
      lines: [`${ICONS.warning} The command failed due to an internal error.`, `${ICONS.loop} Please try again in a moment.`],
      language
    })
  );
}

function withRoleMention(config, content) {
  const roleMention = config.mentionRoleId ? `<@&${config.mentionRoleId}> ` : "";
  return `${roleMention}${content}`;
}

async function sendGuildPrayerNotification(guildId, config, prayerKey, prayerTime, options = {}) {
  const isTest = options.isTest === true;
  const language = resolveConfigLanguage(config);
  const uiText = getPrayerUiText(language);
  const reminderChannel = await client.channels.fetch(config.reminderChannelId).catch(() => null);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    return { ok: false, reason: "Reminder channel was not found or is not text-based." };
  }

  const body = styledBlock({
    icon: isTest ? ICONS.test : ICONS.adhan,
    title: isTest ? uiText.testAdhanTitle : uiText.adhanTitle,
    lines: [
      `${getPrayerEmoji(prayerKey)} **${uiText.prayerLabel}:** ${getPrayerDisplayLabel(prayerKey, language)}`,
      `${ICONS.clock} **${uiText.timeLabel}:** ${prayerTime.toFormat("HH:mm")} (${config.location.timezone})`,
      `${ICONS.hands} ${uiText.acceptanceLine}`
    ],
    language
  });

  await reminderChannel.send({ content: withRoleMention(config, body) });

  if (!config.playAdhanInVoice || !config.adhanVoiceChannelId) {
    return { ok: true, voice: "skipped" };
  }

  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    return { ok: true, voice: "failed", reason: "Guild not found in cache/fetch." };
  }

  const voiceResult = await playAdhanInVoice({
    guild,
    voiceChannelId: config.adhanVoiceChannelId,
    audioFilePath: ADHAN_AUDIO_FILE
  });

  if (!voiceResult.ok) {
    return { ok: true, voice: "failed", reason: voiceResult.reason };
  }

  return { ok: true, voice: "played" };
}

async function sendGuildPrePrayerNotification(guildId, config, prayerKey, prayerTime, leadMinutes) {
  const language = resolveConfigLanguage(config);
  const uiText = getPrayerUiText(language);
  const reminderChannel = await client.channels.fetch(config.reminderChannelId).catch(() => null);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    return { ok: false, reason: "Reminder channel was not found or is not text-based." };
  }

  const body = styledBlock({
    icon: ICONS.clock,
    title: uiText.prePrayerTitle,
    lines: [
      `${getPrayerEmoji(prayerKey)} **${uiText.prayerLabel}:** ${getPrayerDisplayLabel(prayerKey, language)}`,
      `${ICONS.hourglass} **${uiText.startsInLabel}:** ${leadMinutes} minutes`,
      `${ICONS.clock} **${uiText.adhanTimeLabel}:** ${prayerTime.toFormat("HH:mm")} (${config.location.timezone})`,
      `${ICONS.hands} ${uiText.prepareLine}`
    ],
    language
  });

  await reminderChannel.send({ content: withRoleMention(config, body) });
  return { ok: true };
}

async function sendUserPrayerDmNotification(userId, config, prayerKey, prayerTime, options = {}) {
  const isTest = options.isTest === true;
  const language = resolveConfigLanguage(config, { dm: true });
  const uiText = getPrayerUiText(language);
  const user = client.users.cache.get(userId) || (await client.users.fetch(userId).catch(() => null));
  if (!user) {
    return { ok: false, reason: "User not found." };
  }

  const content = styledBlock({
    icon: isTest ? ICONS.test : ICONS.adhan,
    title: isTest ? uiText.testAdhanTitle : uiText.adhanTitle,
    lines: [
      `${getPrayerEmoji(prayerKey)} **${uiText.prayerLabel}:** ${getPrayerDisplayLabel(prayerKey, language)}`,
      `${ICONS.clock} **${uiText.timeLabel}:** ${prayerTime.toFormat("HH:mm")} (${config.location.timezone})`,
      `${ICONS.hands} ${uiText.acceptanceLine}`
    ],
    language
  });

  try {
    await user.send({ content });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Unable to DM user (${error.message}).` };
  }
}

async function sendUserPrePrayerDmNotification(userId, config, prayerKey, prayerTime, leadMinutes) {
  const language = resolveConfigLanguage(config, { dm: true });
  const uiText = getPrayerUiText(language);
  const user = client.users.cache.get(userId) || (await client.users.fetch(userId).catch(() => null));
  if (!user) {
    return { ok: false, reason: "User not found." };
  }

  const content = styledBlock({
    icon: ICONS.clock,
    title: uiText.prePrayerTitle,
    lines: [
      `${getPrayerEmoji(prayerKey)} **${uiText.prayerLabel}:** ${getPrayerDisplayLabel(prayerKey, language)}`,
      `${ICONS.hourglass} **${uiText.startsInLabel}:** ${leadMinutes} minutes`,
      `${ICONS.clock} **${uiText.adhanTimeLabel}:** ${prayerTime.toFormat("HH:mm")} (${config.location.timezone})`,
      `${ICONS.hands} ${uiText.prepareLine}`
    ],
    language
  });

  try {
    await user.send({ content });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Unable to DM user (${error.message}).` };
  }
}

function formatAzkarReminderText(entry, { isTest = false, language = "english" } = {}) {
  const normalizedLanguage = normalizeContentLanguage(language);
  const selectedText = getEntryTextByLanguage(entry, normalizedLanguage);
  return styledBlock({
    icon: isTest ? ICONS.test : ICONS.sparkle,
    title: isTest ? "Test Azkar Reminder" : "Azkar Reminder",
    lines: [
      `## ✨ ${selectedText} ✨`,
      `> ${ICONS.book} **Source:** ${entry.source}`
    ],
    language: normalizedLanguage
  });
}

function formatHadithReminderText(entry, { isTest = false, language = "english" } = {}) {
  const normalizedLanguage = normalizeContentLanguage(language);
  const selectedText = getEntryTextByLanguage(entry, normalizedLanguage);
  return styledBlock({
    icon: isTest ? ICONS.test : ICONS.book,
    title: isTest ? "Test Hadith Reminder" : "Hadith Reminder",
    lines: [
      `## ✨ ${selectedText} ✨`,
      `> ${ICONS.book} **Source:** ${entry.source}`
    ],
    language: normalizedLanguage
  });
}

async function sendGuildAzkarNotification(guildId, config, options = {}) {
  const isTest = options.isTest === true;
  const language = normalizeContentLanguage(options.language || resolveConfigLanguage(config));
  const reminderChannel = await client.channels.fetch(config.reminderChannelId).catch(() => null);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    return { ok: false, reason: "Reminder channel was not found or is not text-based." };
  }

  const { entry, nextRecentIds } = getRandomAzkar({
    recentIds: config.recentAzkarIds,
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  const message = formatAzkarReminderText(entry, { isTest, language });
  await reminderChannel.send({ content: withRoleMention(config, message) });

  return {
    ok: true,
    entry,
    nextRecentIds
  };
}

async function sendGuildHadithNotification(guildId, config, options = {}) {
  const isTest = options.isTest === true;
  const minGrade = normalizeHadithGrade(options.minGrade || config.hadithMinGrade);
  const language = normalizeContentLanguage(options.language || resolveConfigLanguage(config));
  const reminderChannel = await client.channels.fetch(config.reminderChannelId).catch(() => null);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    return { ok: false, reason: "Reminder channel was not found or is not text-based." };
  }

  const { entry, nextRecentIds } = getRandomHadith({
    recentIds: config.recentHadithIds,
    minGrade,
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  const message = formatHadithReminderText(entry, { isTest, language });
  await reminderChannel.send({ content: withRoleMention(config, message) });

  return {
    ok: true,
    entry,
    nextRecentIds
  };
}

async function sendUserAzkarDmNotification(userId, config, options = {}) {
  const isTest = options.isTest === true;
  const language = normalizeContentLanguage(options.language || resolveConfigLanguage(config, { dm: true }));
  const user = client.users.cache.get(userId) || (await client.users.fetch(userId).catch(() => null));
  if (!user) {
    return { ok: false, reason: "User not found." };
  }

  const { entry, nextRecentIds } = getRandomAzkar({
    recentIds: config.recentAzkarIds,
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  const content = formatAzkarReminderText(entry, { isTest, language });

  try {
    await user.send({ content });
    return {
      ok: true,
      entry,
      nextRecentIds
    };
  } catch (error) {
    return { ok: false, reason: `Unable to DM user (${error.message}).` };
  }
}

async function sendUserHadithDmNotification(userId, config, options = {}) {
  const isTest = options.isTest === true;
  const minGrade = normalizeHadithGrade(options.minGrade || config.dmHadithMinGrade);
  const language = normalizeContentLanguage(options.language || resolveConfigLanguage(config, { dm: true }));
  const user = client.users.cache.get(userId) || (await client.users.fetch(userId).catch(() => null));
  if (!user) {
    return { ok: false, reason: "User not found." };
  }

  const { entry, nextRecentIds } = getRandomHadith({
    recentIds: config.recentHadithIds,
    minGrade,
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  const content = formatHadithReminderText(entry, { isTest, language });

  try {
    await user.send({ content });
    return {
      ok: true,
      entry,
      nextRecentIds
    };
  } catch (error) {
    return { ok: false, reason: `Unable to DM user (${error.message}).` };
  }
}

async function checkGuildPrayerTimes(guildId, config) {
  if (!config.reminderChannelId || !hasValidLocation(config)) {
    return;
  }

  const nowInZone = DateTime.now().setZone(config.location.timezone);
  if (!nowInZone.isValid) {
    console.error(`Invalid timezone for guild ${guildId}: ${config.location.timezone}`);
    return;
  }

  let daily;
  try {
    daily = await getPrayerTimesForDate(config.location, nowInZone);
  } catch (error) {
    console.error(`Prayer times fetch failed for guild ${guildId}:`, error.message);
    return;
  }

  const currentMinute = nowInZone.startOf("minute").toFormat("yyyy-LL-dd HH:mm");
  const preReminderEnabled = Boolean(config.prePrayerRemindersEnabled);
  const preReminderLeadMinutes = sanitizePrePrayerLeadMinutes(config.prePrayerLeadMinutes);
  const preReminderSelections = normalizePrePrayerSelections(config.prePrayerSelections);

  for (const prayerKey of PRAYER_ORDER) {
    if (preReminderEnabled && preReminderSelections[prayerKey]) {
      const prePrayerMinute = daily.prayers[prayerKey].minus({ minutes: preReminderLeadMinutes }).startOf("minute");
      const preTriggerToken = `${daily.dateISO}:${prayerKey}:pre:${preReminderLeadMinutes}`;
      const preAlreadyTriggered = config.prePrayerLastTriggered?.[prayerKey] === preTriggerToken;

      if (!preAlreadyTriggered && currentMinute === prePrayerMinute.toFormat("yyyy-LL-dd HH:mm")) {
        const preResult = await sendGuildPrePrayerNotification(
          guildId,
          config,
          prayerKey,
          daily.prayers[prayerKey],
          preReminderLeadMinutes
        );
        if (!preResult.ok) {
          console.error(`Failed to send pre-prayer reminder for guild ${guildId}: ${preResult.reason}`);
        }

        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.prePrayerLastTriggered = {
            ...draft.prePrayerLastTriggered,
            [prayerKey]: preTriggerToken
          };
          return draft;
        });
        break;
      }
    }

    const prayerMinute = daily.prayers[prayerKey].startOf("minute").toFormat("yyyy-LL-dd HH:mm");
    const triggerToken = `${daily.dateISO}:${prayerKey}`;
    const alreadyTriggered = config.lastTriggered?.[prayerKey] === triggerToken;

    if (!alreadyTriggered && currentMinute === prayerMinute) {
      const result = await sendGuildPrayerNotification(guildId, config, prayerKey, daily.prayers[prayerKey]);
      if (!result.ok) {
        console.error(`Failed to send guild reminder for guild ${guildId}: ${result.reason}`);
      } else if (result.voice === "failed") {
        console.error(`Voice playback failed for guild ${guildId}: ${result.reason}`);
      }

      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.lastTriggered = {
          ...draft.lastTriggered,
          [prayerKey]: triggerToken
        };
        return draft;
      });
      break;
    }
  }
}

async function checkUserPrayerTimes(userId, config) {
  const dmPrayerEnabled = Boolean(config.dmRemindersEnabled);
  const dmPrePrayerEnabled = Boolean(config.dmPrePrayerRemindersEnabled);
  if (!hasValidLocation(config) || (!dmPrayerEnabled && !dmPrePrayerEnabled)) {
    return;
  }

  const nowInZone = DateTime.now().setZone(config.location.timezone);
  if (!nowInZone.isValid) {
    console.error(`Invalid timezone for user ${userId}: ${config.location.timezone}`);
    return;
  }

  let daily;
  try {
    daily = await getPrayerTimesForDate(config.location, nowInZone);
  } catch (error) {
    console.error(`Prayer times fetch failed for user ${userId}:`, error.message);
    return;
  }

  const currentMinute = nowInZone.startOf("minute").toFormat("yyyy-LL-dd HH:mm");
  const preReminderLeadMinutes = sanitizePrePrayerLeadMinutes(config.dmPrePrayerLeadMinutes);
  const preReminderSelections = normalizePrePrayerSelections(config.dmPrePrayerSelections);

  for (const prayerKey of PRAYER_ORDER) {
    if (dmPrePrayerEnabled && preReminderSelections[prayerKey]) {
      const prePrayerMinute = daily.prayers[prayerKey].minus({ minutes: preReminderLeadMinutes }).startOf("minute");
      const preTriggerToken = `${daily.dateISO}:${prayerKey}:pre:${preReminderLeadMinutes}`;
      const preAlreadyTriggered = config.dmPrePrayerLastTriggered?.[prayerKey] === preTriggerToken;

      if (!preAlreadyTriggered && currentMinute === prePrayerMinute.toFormat("yyyy-LL-dd HH:mm")) {
        const preResult = await sendUserPrePrayerDmNotification(
          userId,
          config,
          prayerKey,
          daily.prayers[prayerKey],
          preReminderLeadMinutes
        );
        if (!preResult.ok) {
          console.error(`Failed to send DM pre-prayer reminder for user ${userId}: ${preResult.reason}`);
        }

        userStore.updateUserConfig(userId, (draft) => {
          draft.dmPrePrayerLastTriggered = {
            ...draft.dmPrePrayerLastTriggered,
            [prayerKey]: preTriggerToken
          };
          return draft;
        });
        break;
      }
    }

    if (!dmPrayerEnabled) {
      continue;
    }

    const prayerMinute = daily.prayers[prayerKey].startOf("minute").toFormat("yyyy-LL-dd HH:mm");
    const triggerToken = `${daily.dateISO}:${prayerKey}`;
    const alreadyTriggered = config.lastTriggered?.[prayerKey] === triggerToken;

    if (!alreadyTriggered && currentMinute === prayerMinute) {
      const result = await sendUserPrayerDmNotification(userId, config, prayerKey, daily.prayers[prayerKey]);
      if (!result.ok) {
        console.error(`Failed to send DM reminder for user ${userId}: ${result.reason}`);
      }

      userStore.updateUserConfig(userId, (draft) => {
        draft.lastTriggered = {
          ...draft.lastTriggered,
          [prayerKey]: triggerToken
        };
        return draft;
      });
      break;
    }
  }
}

async function checkGuildAzkarReminders(guildId, config) {
  if (!config.azkarRemindersEnabled || !config.reminderChannelId || !hasValidLocation(config)) {
    return;
  }

  const zone = config.location.timezone;
  const nowInZone = DateTime.now().setZone(zone);
  if (!nowInZone.isValid) {
    console.error(`Invalid timezone for guild ${guildId}: ${zone}`);
    return;
  }

  const intervalMinutes = sanitizeIntervalMinutes(config.azkarIntervalMinutes);
  const lastSent = toSafeIso(config.azkarLastSentAt, zone);
  if (!lastSent) {
    guildStore.updateGuildConfig(guildId, (draft) => {
      draft.azkarLastSentAt = nowInZone.toISO();
      return draft;
    });
    return;
  }

  const elapsedMinutes = nowInZone.diff(lastSent, "minutes").minutes;
  if (elapsedMinutes < intervalMinutes) {
    return;
  }

  const result = await sendGuildAzkarNotification(guildId, config);
  if (!result.ok) {
    console.error(`Failed to send azkar reminder for guild ${guildId}: ${result.reason}`);
    return;
  }

  guildStore.updateGuildConfig(guildId, (draft) => {
    draft.azkarLastSentAt = nowInZone.toISO();
    draft.recentAzkarIds = result.nextRecentIds;
    return draft;
  });
}

async function checkUserAzkarReminders(userId, config) {
  if (!config.dmAzkarRemindersEnabled || !hasValidLocation(config)) {
    return;
  }

  const zone = config.location.timezone;
  const nowInZone = DateTime.now().setZone(zone);
  if (!nowInZone.isValid) {
    console.error(`Invalid timezone for user ${userId}: ${zone}`);
    return;
  }

  const intervalMinutes = sanitizeIntervalMinutes(config.dmAzkarIntervalMinutes);
  const lastSent = toSafeIso(config.dmAzkarLastSentAt, zone);
  if (!lastSent) {
    userStore.updateUserConfig(userId, (draft) => {
      draft.dmAzkarLastSentAt = nowInZone.toISO();
      return draft;
    });
    return;
  }

  const elapsedMinutes = nowInZone.diff(lastSent, "minutes").minutes;
  if (elapsedMinutes < intervalMinutes) {
    return;
  }

  const result = await sendUserAzkarDmNotification(userId, config);
  if (!result.ok) {
    console.error(`Failed to send DM azkar reminder for user ${userId}: ${result.reason}`);
    return;
  }

  userStore.updateUserConfig(userId, (draft) => {
    draft.dmAzkarLastSentAt = nowInZone.toISO();
    draft.recentAzkarIds = result.nextRecentIds;
    return draft;
  });
}

async function checkGuildHadithReminders(guildId, config) {
  if (!config.hadithRemindersEnabled || !config.reminderChannelId || !hasValidLocation(config)) {
    return;
  }

  const zone = config.location.timezone;
  const nowInZone = DateTime.now().setZone(zone);
  if (!nowInZone.isValid) {
    console.error(`Invalid timezone for guild ${guildId}: ${zone}`);
    return;
  }

  const reminderTime = normalizeReminderTime(config.hadithReminderTime);
  const scheduled = DateTime.fromFormat(`${nowInZone.toISODate()} ${reminderTime}`, "yyyy-LL-dd HH:mm", {
    zone
  });
  if (!scheduled.isValid) {
    console.error(`Invalid hadith reminder time for guild ${guildId}: ${reminderTime}`);
    return;
  }

  const currentMinute = nowInZone.startOf("minute").toFormat("yyyy-LL-dd HH:mm");
  const targetMinute = scheduled.startOf("minute").toFormat("yyyy-LL-dd HH:mm");
  const triggerToken = `${nowInZone.toISODate()}:${reminderTime}`;
  if (currentMinute !== targetMinute || config.hadithLastTriggeredDate === triggerToken) {
    return;
  }

  const result = await sendGuildHadithNotification(guildId, config);
  if (!result.ok) {
    console.error(`Failed to send hadith reminder for guild ${guildId}: ${result.reason}`);
    return;
  }

  guildStore.updateGuildConfig(guildId, (draft) => {
    draft.hadithLastTriggeredDate = triggerToken;
    draft.recentHadithIds = result.nextRecentIds;
    return draft;
  });
}

async function checkUserHadithReminders(userId, config) {
  if (!config.dmHadithRemindersEnabled || !hasValidLocation(config)) {
    return;
  }

  const zone = config.location.timezone;
  const nowInZone = DateTime.now().setZone(zone);
  if (!nowInZone.isValid) {
    console.error(`Invalid timezone for user ${userId}: ${zone}`);
    return;
  }

  const reminderTime = normalizeReminderTime(config.dmHadithReminderTime);
  const scheduled = DateTime.fromFormat(`${nowInZone.toISODate()} ${reminderTime}`, "yyyy-LL-dd HH:mm", {
    zone
  });
  if (!scheduled.isValid) {
    console.error(`Invalid hadith reminder time for user ${userId}: ${reminderTime}`);
    return;
  }

  const currentMinute = nowInZone.startOf("minute").toFormat("yyyy-LL-dd HH:mm");
  const targetMinute = scheduled.startOf("minute").toFormat("yyyy-LL-dd HH:mm");
  const triggerToken = `${nowInZone.toISODate()}:${reminderTime}`;
  if (currentMinute !== targetMinute || config.dmHadithLastTriggeredDate === triggerToken) {
    return;
  }

  const result = await sendUserHadithDmNotification(userId, config);
  if (!result.ok) {
    console.error(`Failed to send DM hadith reminder for user ${userId}: ${result.reason}`);
    return;
  }

  userStore.updateUserConfig(userId, (draft) => {
    draft.dmHadithLastTriggeredDate = triggerToken;
    draft.recentHadithIds = result.nextRecentIds;
    return draft;
  });
}

async function checkAllReminders() {
  if (isRunningCheck) {
    return;
  }
  isRunningCheck = true;

  try {
    const allGuildConfigs = guildStore.getAllConfigs();
    for (const [guildId, config] of Object.entries(allGuildConfigs)) {
      await checkGuildPrayerTimes(guildId, config);
      await checkGuildAzkarReminders(guildId, config);
      await checkGuildHadithReminders(guildId, config);
    }

    const allUserConfigs = userStore.getAllConfigs();
    for (const [userId, config] of Object.entries(allUserConfigs)) {
      await checkUserPrayerTimes(userId, config);
      await checkUserAzkarReminders(userId, config);
      await checkUserHadithReminders(userId, config);
    }
  } catch (error) {
    console.error("Scheduler loop failed:", error.message);
  } finally {
    isRunningCheck = false;
  }
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await checkAllReminders();
  setInterval(checkAllReminders, CHECK_INTERVAL_MS);
});

async function requireManageGuild(interaction) {
  if (!userCanManageGuild(interaction)) {
    await interaction.reply({
      content: styledError("You need Manage Server permission to use this command."),
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
  return true;
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    try {
      await handleAutocompleteInteraction(interaction);
    } catch (error) {
      console.error("Autocomplete failed:", error.message);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commandName = interaction.commandName;
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId && GUILD_ONLY_COMMANDS.has(commandName)) {
    await interaction.reply({
      content: styledBlock({
        icon: ICONS.home,
        title: "Server Command",
        lines: [`${ICONS.warning} This command can only be used inside a server.`]
      })
    });
    return;
  }

  const guildConfig = guildId ? guildStore.getGuildConfig(guildId) : null;
  const userConfig = USER_COMMANDS.has(commandName) ? userStore.getUserConfig(userId) : null;
  const interactionLanguage = USER_COMMANDS.has(commandName)
    ? resolveConfigLanguage(userConfig, { dm: true })
    : resolveConfigLanguage(guildConfig);

  return languageContext.run({ language: interactionLanguage }, async () => {
    try {
      if (commandName === "set-location") {
        if (!(await requireManageGuild(interaction))) {
          return;
        }

      const city = interaction.options.getString("city", true).trim();
      const country = interaction.options.getString("country", true).trim();
      const method = interaction.options.getInteger("method") ?? 3;
      const school = interaction.options.getInteger("school") ?? 0;

      const locationValidationError = validateCityCountryInput(city, country);
      if (locationValidationError) {
        await interaction.reply({
          content: styledError(locationValidationError),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      let resolvedLocation;
      try {
        resolvedLocation = await resolveCityCountryLocation({
          city,
          country,
          method,
          school
        });
      } catch (error) {
        await interaction.reply({
          content: styledError(`Could not resolve that city/country: ${error.message}`),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.location = resolvedLocation;
        draft.lastTriggered = {};
        draft.prePrayerLastTriggered = {};
        if (draft.azkarRemindersEnabled) {
          draft.azkarLastSentAt = DateTime.now().setZone(resolvedLocation.timezone).toISO();
        }
        draft.hadithLastTriggeredDate = null;
        return draft;
      });

      await interaction.reply({
        content: styledBlock({
          icon: ICONS.adhan,
          title: "Server Location Updated",
          lines: [...formatLocationLines(resolvedLocation), `${ICONS.hands} _Prayer timings will now use this location._`]
        }),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "set-channels") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      const reminderChannel = interaction.options.getChannel("reminder_channel", true);
      const voiceChannel = interaction.options.getChannel("voice_channel");
      const playVoiceOption = interaction.options.getBoolean("play_voice");

      const nextVoiceChannelId = voiceChannel ? voiceChannel.id : guildConfig.adhanVoiceChannelId;
      const nextPlayVoice =
        playVoiceOption !== null
          ? playVoiceOption
          : voiceChannel
            ? true
            : guildConfig.playAdhanInVoice;

      if (nextPlayVoice && !nextVoiceChannelId) {
        await interaction.reply({
          content: styledError("Voice playback is enabled but no voice channel is configured."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.reminderChannelId = reminderChannel.id;
        draft.adhanVoiceChannelId = nextVoiceChannelId;
        draft.playAdhanInVoice = nextPlayVoice;
        return draft;
      });

      await interaction.reply({
        content: styledBlock({
          icon: ICONS.megaphone,
          title: "Channel Settings Updated",
          lines: [
            `${ICONS.note} **Reminder Channel:** <#${reminderChannel.id}>`,
            `${ICONS.speaker} **Voice Channel:** ${nextVoiceChannelId ? `<#${nextVoiceChannelId}>` : "Not set"}`,
            `${ICONS.headset} **Voice Playback:** ${nextPlayVoice ? "Enabled" : "Disabled"}`
          ]
        }),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "set-mention-role") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      const role = interaction.options.getRole("role");
      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.mentionRoleId = role ? role.id : null;
        return draft;
      });

      await interaction.reply({
        content: styledBlock({
          icon: ICONS.people,
          title: "Mention Role Updated",
          lines: [role ? `${ICONS.note} **Role:** <@&${role.id}>` : `${ICONS.note} **Role:** None`]
        }),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "set-azkar-reminders") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      const enabled = interaction.options.getBoolean("enabled", true);
      const intervalOption = interaction.options.getInteger("interval_minutes");
      const languageOption = interaction.options.getString("language");
      const nextInterval = sanitizeIntervalMinutes(intervalOption ?? guildConfig.azkarIntervalMinutes);
      const nextLanguage = normalizeContentLanguage(languageOption || resolveConfigLanguage(guildConfig));

      if (enabled && !guildConfig.reminderChannelId) {
        await interaction.reply({
          content: styledError("Reminder channel is not configured. Use /set-channels first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (enabled && !hasValidLocation(guildConfig)) {
        await interaction.reply({
          content: styledError("Location is not configured. Use /set-location first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const nowIso = hasValidLocation(guildConfig)
        ? DateTime.now().setZone(guildConfig.location.timezone).toISO()
        : DateTime.now().toISO();

      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.azkarRemindersEnabled = enabled;
        draft.azkarIntervalMinutes = nextInterval;
        draft.language = nextLanguage;
        draft.azkarLanguage = nextLanguage;
        draft.hadithLanguage = nextLanguage;
        if (enabled) {
          draft.azkarLastSentAt = nowIso;
        }
        return draft;
      });

      await interaction.reply({
        content: styledBlock({
          icon: ICONS.sparkle,
          title: enabled ? "Azkar Reminders Enabled" : "Azkar Reminders Disabled",
          lines: [
            `${ICONS.loop} **Status:** ${enabled ? "Enabled" : "Disabled"}`,
            `${ICONS.clock} **Interval:** Every ${nextInterval} minutes`,
            `${ICONS.book} **Language:** ${getContentLanguageLabel(nextLanguage)}`
          ],
          language: nextLanguage
        }),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "set-hadith-reminders") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      const enabled = interaction.options.getBoolean("enabled", true);
      const hour = interaction.options.getInteger("hour");
      const minute = interaction.options.getInteger("minute");
      const minGrade = normalizeHadithGrade(interaction.options.getString("min_grade") || guildConfig.hadithMinGrade);
      const language = normalizeContentLanguage(
        interaction.options.getString("language") || resolveConfigLanguage(guildConfig)
      );
      const reminderTime = buildReminderTime({
        hour,
        minute,
        fallback: guildConfig.hadithReminderTime
      });

      if (enabled && !guildConfig.reminderChannelId) {
        await interaction.reply({
          content: styledError("Reminder channel is not configured. Use /set-channels first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (enabled && !hasValidLocation(guildConfig)) {
        await interaction.reply({
          content: styledError("Location is not configured. Use /set-location first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.hadithRemindersEnabled = enabled;
        draft.hadithReminderTime = reminderTime;
        draft.hadithMinGrade = minGrade;
        draft.language = language;
        draft.azkarLanguage = language;
        draft.hadithLanguage = language;
        if (enabled) {
          draft.hadithLastTriggeredDate = null;
        }
        return draft;
      });

      await interaction.reply({
        content: styledBlock({
          icon: ICONS.book,
          title: enabled ? "Hadith Reminders Enabled" : "Hadith Reminders Disabled",
          lines: [
            `${ICONS.loop} **Status:** ${enabled ? "Enabled" : "Disabled"}`,
            `${ICONS.clock} **Time:** ${reminderTime} (${guildConfig.location?.timezone || "UTC"})`,
            `${ICONS.chart} **Grade Filter:** ${HADITH_GRADE_LABELS[minGrade] || minGrade}`,
            `${ICONS.book} **Language:** ${getContentLanguageLabel(language)}`
          ],
          language
        }),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "config") {
      await interaction.reply({
        content: formatGuildConfig(guildConfig),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "delete-guild-data") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      const deleted = guildStore.deleteGuildConfig(guildId);
      await interaction.reply({
        content: styledBlock({
          icon: ICONS.warning,
          title: "Server Data Deleted",
          lines: [
            deleted
              ? `${ICONS.check} Deleted stored configuration for this server.`
              : `${ICONS.mailbox} No stored configuration was found for this server.`,
            `${ICONS.note} You can reconfigure anytime using /set-location and /set-channels.`
          ]
        }),
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (commandName === "prayer-times") {
      if (!hasValidLocation(guildConfig)) {
        await interaction.reply({
          content: styledError("Location is not configured. Use /set-location first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const dateInput = interaction.options.getString("date");
      let targetDate = DateTime.now().setZone(guildConfig.location.timezone);

      if (dateInput) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          await interaction.reply({
            content: styledError("Invalid date format. Use YYYY-MM-DD."),
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const parsedDate = DateTime.fromISO(dateInput, {
          zone: guildConfig.location.timezone
        });
        if (!parsedDate.isValid) {
          await interaction.reply({
            content: styledError("Could not parse that date. Use YYYY-MM-DD."),
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        targetDate = parsedDate;
      }

      const daily = await getPrayerTimesForDate(guildConfig.location, targetDate);
      const language = resolveConfigLanguage(guildConfig);
      const uiText = getPrayerUiText(language);
      await interaction.reply({
        content: styledBlock({
          icon: ICONS.compass,
          title: `${uiText.prayerTimesTitle} - ${daily.dateISO}`,
          lines: [
            `${ICONS.globe} **${uiText.timezoneLabel}:** ${guildConfig.location.timezone}`,
            formatPrayerLines(daily.prayers, { language })
          ]
        })
      });
      return;
    }

    if (commandName === "next-prayer") {
      if (!hasValidLocation(guildConfig)) {
        await interaction.reply({
          content: styledError("Location is not configured. Use /set-location first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const nextPrayer = await getNextPrayer(guildConfig.location, DateTime.now());
      const language = resolveConfigLanguage(guildConfig);
      const uiText = getPrayerUiText(language);
      const unix = Math.floor(nextPrayer.time.toSeconds());
      await interaction.reply({
        content: styledBlock({
          icon: ICONS.moon,
          title: uiText.nextPrayerTitle,
          lines: [
            `${getPrayerEmoji(nextPrayer.prayerKey)} **${getPrayerDisplayLabel(nextPrayer.prayerKey, language)}:** ${nextPrayer.time.toFormat("HH:mm")} (${guildConfig.location.timezone})`,
            `${ICONS.clock} **${uiText.discordTimeLabel}:** <t:${unix}:F>`,
            `${ICONS.hourglass} **${uiText.startsLabel}:** <t:${unix}:R>`
          ]
        })
      });
      return;
    }

    if (commandName === "test-adhan") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      if (!guildConfig.reminderChannelId) {
        await interaction.reply({
          content: styledError("Reminder channel is not configured. Use /set-channels first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (!hasValidLocation(guildConfig)) {
        await interaction.reply({
          content: styledError("Location is not configured. Use /set-location first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const prayerKey = interaction.options.getString("prayer") || "fajr";
      const testSchedule = await getTestPrayerSchedule(guildConfig.location, prayerKey);
      const result = await sendGuildPrayerNotification(
        guildId,
        guildConfig,
        testSchedule.prayerKey,
        testSchedule.prayerTime,
        { isTest: true }
      );

      if (!result.ok) {
        await interaction.editReply({
          content: styledError(`Test failed: ${result.reason}`)
        });
        return;
      }

      let response = styledBlock({
        icon: ICONS.test,
        title: "Test Reminder Sent",
        lines: [`${ICONS.note} Test message delivered to the configured reminder channel.`],
        language: resolveConfigLanguage(guildConfig)
      });
      const responseLanguage = resolveConfigLanguage(guildConfig);
      if (guildConfig.playAdhanInVoice) {
        if (result.voice === "played") {
          response += `\n${localizeText(`${ICONS.loud} Voice playback started.`, responseLanguage)}`;
        } else if (result.voice === "failed") {
          response += `\n${localizeText(`${ICONS.warning} Voice playback failed: ${result.reason}`, responseLanguage)}`;
        } else {
          response += `\n${localizeText(`${ICONS.hourglass} Voice playback skipped.`, responseLanguage)}`;
        }
      }
      response += `\n${localizeText(`${ICONS.clock} Scheduled prayer time: ${testSchedule.prayerTime.toFormat("HH:mm")} ${guildConfig.location.timezone}.`, responseLanguage)}`;

      await interaction.editReply({ content: normalizeDisplayText(response) });
      return;
    }

    if (commandName === "test-azkar") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      if (!guildConfig.reminderChannelId) {
        await interaction.reply({
          content: styledError("Reminder channel is not configured. Use /set-channels first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await sendGuildAzkarNotification(guildId, guildConfig, { isTest: true });
      if (!result.ok) {
        await interaction.editReply({ content: styledError(`Test failed: ${result.reason}`) });
        return;
      }

      await interaction.editReply({
        content: styledBlock({
          icon: ICONS.test,
          title: "Test Azkar Sent",
          lines: [
            `${ICONS.note} Random azkar reminder sent to the configured reminder channel.`,
            `${ICONS.book} Source: ${result.entry.source}`
          ]
        })
      });
      return;
    }

    if (commandName === "test-hadith") {
      if (!(await requireManageGuild(interaction))) {
        return;
      }

      if (!guildConfig.reminderChannelId) {
        await interaction.reply({
          content: styledError("Reminder channel is not configured. Use /set-channels first."),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await sendGuildHadithNotification(guildId, guildConfig, { isTest: true });
      if (!result.ok) {
        await interaction.editReply({ content: styledError(`Test failed: ${result.reason}`) });
        return;
      }

      await interaction.editReply({
        content: styledBlock({
          icon: ICONS.test,
          title: "Test Hadith Sent",
          lines: [
            `${ICONS.note} Random hadith reminder sent to the configured reminder channel.`,
            `${ICONS.book} Source: ${result.entry.source}`
          ]
        })
      });
      return;
    }

    if (commandName === "my-location") {
      const city = interaction.options.getString("city", true).trim();
      const country = interaction.options.getString("country", true).trim();
      const method = interaction.options.getInteger("method") ?? 3;
      const school = interaction.options.getInteger("school") ?? 0;

      const locationValidationError = validateCityCountryInput(city, country);
      if (locationValidationError) {
        await interaction.reply(privateResponseOptions(interaction, styledError(locationValidationError)));
        return;
      }

      let resolvedLocation;
      try {
        resolvedLocation = await resolveCityCountryLocation({
          city,
          country,
          method,
          school
        });
      } catch (error) {
        await interaction.reply(
          privateResponseOptions(interaction, styledError(`Could not resolve that city/country: ${error.message}`))
        );
        return;
      }

      userStore.updateUserConfig(userId, (draft) => {
        draft.location = resolvedLocation;
        draft.lastTriggered = {};
        draft.dmPrePrayerLastTriggered = {};
        if (draft.dmAzkarRemindersEnabled) {
          draft.dmAzkarLastSentAt = DateTime.now().setZone(resolvedLocation.timezone).toISO();
        }
        draft.dmHadithLastTriggeredDate = null;
        return draft;
      });

      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.hands,
            title: "Personal Location Updated",
            lines: [...formatLocationLines(resolvedLocation), `${ICONS.mail} _DM reminders will use this location._`]
          })
        )
      );
      return;
    }

    if (commandName === "dm-reminders") {
      const enabled = interaction.options.getBoolean("enabled", true);

      if (enabled && !hasValidLocation(userConfig)) {
        await interaction.reply(
          privateResponseOptions(
            interaction,
            styledError("Set your location first with /my-location before enabling DM reminders.")
          )
        );
        return;
      }

      userStore.updateUserConfig(userId, (draft) => {
        draft.dmRemindersEnabled = enabled;
        if (enabled) {
          draft.lastTriggered = {};
        }
        return draft;
      });

      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.mail,
            title: enabled ? "DM Prayer Reminders Enabled" : "DM Prayer Reminders Disabled",
            lines: [
              enabled
                ? `${ICONS.hands} You will receive adhan reminders in your direct messages.`
                : `${ICONS.mailbox} Personal DM prayer reminders have been turned off.`
            ]
          })
        )
      );
      return;
    }

    if (commandName === "dm-azkar-reminders") {
      const enabled = interaction.options.getBoolean("enabled", true);
      const intervalOption = interaction.options.getInteger("interval_minutes");
      const languageOption = interaction.options.getString("language");
      const nextInterval = sanitizeIntervalMinutes(intervalOption ?? userConfig.dmAzkarIntervalMinutes);
      const nextLanguage = normalizeContentLanguage(languageOption || resolveConfigLanguage(userConfig, { dm: true }));

      if (enabled && !hasValidLocation(userConfig)) {
        await interaction.reply(
          privateResponseOptions(
            interaction,
            styledError("Set your location first with /my-location before enabling DM azkar reminders.")
          )
        );
        return;
      }

      const nowIso = hasValidLocation(userConfig)
        ? DateTime.now().setZone(userConfig.location.timezone).toISO()
        : DateTime.now().toISO();

      userStore.updateUserConfig(userId, (draft) => {
        draft.dmAzkarRemindersEnabled = enabled;
        draft.dmAzkarIntervalMinutes = nextInterval;
        draft.language = nextLanguage;
        draft.dmAzkarLanguage = nextLanguage;
        draft.dmHadithLanguage = nextLanguage;
        if (enabled) {
          draft.dmAzkarLastSentAt = nowIso;
        }
        return draft;
      });

      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.sparkle,
            title: enabled ? "DM Azkar Enabled" : "DM Azkar Disabled",
            lines: [
              `${ICONS.loop} **Status:** ${enabled ? "Enabled" : "Disabled"}`,
              `${ICONS.clock} **Interval:** Every ${nextInterval} minutes`,
              `${ICONS.book} **Language:** ${getContentLanguageLabel(nextLanguage)}`
            ],
            language: nextLanguage
          })
        )
      );
      return;
    }

    if (commandName === "dm-hadith-reminders") {
      const enabled = interaction.options.getBoolean("enabled", true);
      const hour = interaction.options.getInteger("hour");
      const minute = interaction.options.getInteger("minute");
      const minGrade = normalizeHadithGrade(interaction.options.getString("min_grade") || userConfig.dmHadithMinGrade);
      const language = normalizeContentLanguage(
        interaction.options.getString("language") || resolveConfigLanguage(userConfig, { dm: true })
      );
      const reminderTime = buildReminderTime({
        hour,
        minute,
        fallback: userConfig.dmHadithReminderTime
      });

      if (enabled && !hasValidLocation(userConfig)) {
        await interaction.reply(
          privateResponseOptions(
            interaction,
            styledError("Set your location first with /my-location before enabling DM hadith reminders.")
          )
        );
        return;
      }

      userStore.updateUserConfig(userId, (draft) => {
        draft.dmHadithRemindersEnabled = enabled;
        draft.dmHadithReminderTime = reminderTime;
        draft.dmHadithMinGrade = minGrade;
        draft.language = language;
        draft.dmAzkarLanguage = language;
        draft.dmHadithLanguage = language;
        if (enabled) {
          draft.dmHadithLastTriggeredDate = null;
        }
        return draft;
      });

      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.book,
            title: enabled ? "DM Hadith Enabled" : "DM Hadith Disabled",
            lines: [
              `${ICONS.loop} **Status:** ${enabled ? "Enabled" : "Disabled"}`,
              `${ICONS.clock} **Time:** ${reminderTime} (${userConfig.location?.timezone || "UTC"})`,
              `${ICONS.chart} **Grade Filter:** ${HADITH_GRADE_LABELS[minGrade] || minGrade}`,
              `${ICONS.book} **Language:** ${getContentLanguageLabel(language)}`
            ],
            language
          })
        )
      );
      return;
    }

    if (commandName === "dm-config") {
      await interaction.reply(privateResponseOptions(interaction, formatUserConfig(userConfig)));
      return;
    }

    if (commandName === "export-my-data") {
      const exportConfig = userStore.getUserConfig(userId);
      const json = `${JSON.stringify(exportConfig, null, 2)}\n`;
      const file = {
        attachment: Buffer.from(json, "utf8"),
        name: `adhan-reminder-user-${userId}.json`
      };
      const content = styledBlock({
        icon: ICONS.note,
        title: "Data Export",
        lines: [`${ICONS.book} Attached is your stored DM configuration.`]
      });
      await interaction.reply(
        interaction.inGuild()
          ? { content, files: [file], flags: MessageFlags.Ephemeral }
          : { content, files: [file] }
      );
      return;
    }

    if (commandName === "delete-my-data") {
      const deleted = userStore.deleteUserConfig(userId);
      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.warning,
            title: "Personal Data Deleted",
            lines: [
              deleted
                ? `${ICONS.check} Deleted your stored DM configuration.`
                : `${ICONS.mailbox} No stored DM configuration was found for your account.`,
              `${ICONS.note} You can reconfigure anytime with /my-location and /dm-reminders.`
            ]
          })
        )
      );
      return;
    }

    if (commandName === "dm-prayer-times") {
      if (!hasValidLocation(userConfig)) {
        await interaction.reply(
          privateResponseOptions(interaction, styledError("Location is not configured. Use /my-location first."))
        );
        return;
      }

      const dateInput = interaction.options.getString("date");
      let targetDate = DateTime.now().setZone(userConfig.location.timezone);

      if (dateInput) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          await interaction.reply(privateResponseOptions(interaction, styledError("Invalid date format. Use YYYY-MM-DD.")));
          return;
        }

        const parsedDate = DateTime.fromISO(dateInput, {
          zone: userConfig.location.timezone
        });
        if (!parsedDate.isValid) {
          await interaction.reply(privateResponseOptions(interaction, styledError("Could not parse that date. Use YYYY-MM-DD.")));
          return;
        }
        targetDate = parsedDate;
      }

      const daily = await getPrayerTimesForDate(userConfig.location, targetDate);
      const language = resolveConfigLanguage(userConfig, { dm: true });
      const uiText = getPrayerUiText(language);
      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.compass,
            title: `${uiText.prayerTimesTitle} - ${daily.dateISO}`,
            lines: [
              `${ICONS.globe} **${uiText.timezoneLabel}:** ${userConfig.location.timezone}`,
              formatPrayerLines(daily.prayers, { language })
            ]
          })
        )
      );
      return;
    }

    if (commandName === "dm-next-prayer") {
      if (!hasValidLocation(userConfig)) {
        await interaction.reply(
          privateResponseOptions(interaction, styledError("Location is not configured. Use /my-location first."))
        );
        return;
      }

      const nextPrayer = await getNextPrayer(userConfig.location, DateTime.now());
      const language = resolveConfigLanguage(userConfig, { dm: true });
      const uiText = getPrayerUiText(language);
      const unix = Math.floor(nextPrayer.time.toSeconds());
      await interaction.reply(
        privateResponseOptions(
          interaction,
          styledBlock({
            icon: ICONS.moon,
            title: uiText.nextPrayerTitle,
            lines: [
              `${getPrayerEmoji(nextPrayer.prayerKey)} **${getPrayerDisplayLabel(nextPrayer.prayerKey, language)}:** ${nextPrayer.time.toFormat("HH:mm")} (${userConfig.location.timezone})`,
              `${ICONS.clock} **${uiText.discordTimeLabel}:** <t:${unix}:F>`,
              `${ICONS.hourglass} **${uiText.startsLabel}:** <t:${unix}:R>`
            ]
          })
        )
      );
      return;
    }

    if (commandName === "dm-test") {
      if (!hasValidLocation(userConfig)) {
        await interaction.reply(
          privateResponseOptions(interaction, styledError("Location is not configured. Use /my-location first."))
        );
        return;
      }

      if (interaction.inGuild()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } else {
        await interaction.deferReply();
      }

      const prayerKey = interaction.options.getString("prayer") || "fajr";
      const testSchedule = await getTestPrayerSchedule(userConfig.location, prayerKey);
      const result = await sendUserPrayerDmNotification(
        userId,
        userConfig,
        testSchedule.prayerKey,
        testSchedule.prayerTime,
        { isTest: true }
      );

      if (!result.ok) {
        await interaction.editReply({ content: styledError(`Test failed: ${result.reason}`) });
        return;
      }

      await interaction.editReply({
        content: styledBlock({
          icon: ICONS.test,
          title: "Test DM Sent",
          lines: [
            `${ICONS.mail} Check your direct messages for the sample reminder.`,
            `${ICONS.clock} Scheduled prayer time: ${testSchedule.prayerTime.toFormat("HH:mm")} ${userConfig.location.timezone}.`
          ]
        })
      });
      return;
    }

    if (commandName === "dm-test-azkar") {
      if (interaction.inGuild()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } else {
        await interaction.deferReply();
      }

      const result = await sendUserAzkarDmNotification(userId, userConfig, { isTest: true });
      if (!result.ok) {
        await interaction.editReply({ content: styledError(`Test failed: ${result.reason}`) });
        return;
      }

      await interaction.editReply({
        content: styledBlock({
          icon: ICONS.test,
          title: "Test Azkar DM Sent",
          lines: [
            `${ICONS.mail} Check your direct messages for the random azkar.`,
            `${ICONS.book} Source: ${result.entry.source}`
          ]
        })
      });
      return;
    }

      if (commandName === "dm-test-hadith") {
        if (interaction.inGuild()) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
          await interaction.deferReply();
        }

        const result = await sendUserHadithDmNotification(userId, userConfig, { isTest: true });
        if (!result.ok) {
          await interaction.editReply({ content: styledError(`Test failed: ${result.reason}`) });
          return;
        }

        await interaction.editReply({
          content: styledBlock({
            icon: ICONS.test,
            title: "Test Hadith DM Sent",
            lines: [
              `${ICONS.mail} Check your direct messages for the random hadith.`,
              `${ICONS.book} Source: ${result.entry.source}`
            ]
          })
        });
        return;
      }
    } catch (error) {
      console.error(`Command failed (${commandName}):`, error.message);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorResponseOptions(interaction, interactionLanguage));
      } else {
        await interaction.reply(errorResponseOptions(interaction, interactionLanguage));
      }
    }
  });
});

client.login(token);





