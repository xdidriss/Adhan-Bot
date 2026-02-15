const crypto = require("node:crypto");
const path = require("node:path");
const { ChannelType, PermissionsBitField } = require("discord.js");
const express = require("express");
const session = require("express-session");

const { METHOD_CHOICES, SCHOOL_CHOICES } = require("./commands");
const {
  CONTENT_LANGUAGE_CHOICES,
  HADITH_MIN_GRADE_CHOICES,
  getEntryTextByLanguage,
  getRandomAzkar,
  getRandomHadith,
  normalizeContentLanguage,
  normalizeHadithGrade
} = require("./islamicContentService");
const { resolveCityCountryLocation } = require("./prayerTimesService");

const MANAGE_GUILD_FLAG = BigInt(PermissionsBitField.Flags.ManageGuild);
const DEFAULT_HADITH_TIME = "20:00";
const DEFAULT_AZKAR_INTERVAL_MINUTES = 180;
const RECENT_CONTENT_HISTORY_SIZE = 12;
const DEFAULT_PRE_PRAYER_LEAD_MINUTES = 10;
const PRE_PRAYER_LEAD_CHOICES = [5, 10, 15];
const PRE_PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const DASHBOARD_PRAYER_LABELS = {
  english: {
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha"
  },
  arabic: {
    fajr: "\u0627\u0644\u0641\u062c\u0631",
    dhuhr: "\u0627\u0644\u0638\u0647\u0631",
    asr: "\u0627\u0644\u0639\u0635\u0631",
    maghrib: "\u0627\u0644\u0645\u063a\u0631\u0628",
    isha: "\u0627\u0644\u0639\u0634\u0627\u0621"
  }
};
const DASHBOARD_PRAYER_EMOJIS = {
  fajr: "\u{1F305}",
  dhuhr: "\u2600\uFE0F",
  asr: "\u{1F324}\uFE0F",
  maghrib: "\u{1F307}",
  isha: "\u{1F319}"
};
const DISCORD_SYNC_TTL_MS =
  Math.max(15, Number(process.env.DASHBOARD_DISCORD_SYNC_SECONDS || 90)) * 1000;
const DASHBOARD_LANGUAGE_CHOICES = [
  { value: "english", label: "English" },
  { value: "arabic", label: "العربية" }
];
const DASHBOARD_I18N = {
  english: {
    htmlLang: "en",
    htmlDir: "ltr",
    brandTitle: "Adhan Reminder",
    brandSubtitle: "Ramadan-themed control panel",
    inviteBot: "Invite Bot",
    dashboard: "Dashboard",
    logout: "Logout",
    loginWithDiscord: "Login with Discord",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    footerRights: "All rights reserved.",
    languageAriaLabel: "Dashboard language",
    themeAriaLabel: "Theme",
    themeLightLabel: "Light",
    themeDarkLabel: "Dark",
    homeTitle: "Prayer reminders, azkar, hadith, and voice adhan in one place",
    homeDescription:
      "Configure everything from web: prayer location, channels, voice playback, role mentions, DM reminders, random azkar intervals, and daily hadith timing with grade filtering.",
    homePrimaryCtaOpen: "Open Dashboard",
    homePrimaryCtaSetup: "Login setup required",
    featureGuildTitle: "Guild Controls",
    featureGuildDesc: "Set channels, voice adhan, mention role, and all reminder schedules per server.",
    featureDmTitle: "Personal DM Panel",
    featureDmDesc: "Manage your own location and DM reminders for prayer, azkar, and hadith.",
    featureStyleTitle: "Ramadan Look",
    featureStyleDesc: "Intentional Islamic visual style with calm night colors and gold accents.",
    personalDmSettingsTitle: "Personal DM Settings",
    personalDmSettingsDesc: "These settings control reminders sent to your direct messages.",
    cityLabel: "City",
    countryLabel: "Country",
    methodLabel: "Method",
    schoolLabel: "School",
    cityPlaceholder: "e.g. Biskra",
    countryPlaceholder: "e.g. Algeria",
    dmPrayerRemindersLabel: "DM Prayer Reminders",
    dmAzkarRemindersLabel: "DM Azkar Reminders",
    dmAzkarHint: "Uses interval below.",
    dmHadithRemindersLabel: "DM Hadith Reminders",
    dmHadithHint: "Uses daily time below.",
    dmPrePrayerRemindersLabel: "DM Pre-Prayer Reminders",
    dmPrePrayerHint: "Sends a reminder before selected prayers.",
    globalLanguageLabel: "Language (Global)",
    prePrayerLeadLabel: "Lead Time (minutes)",
    prePrayerPrayersLabel: "Prayers",
    beforePrayerSuffix: "minutes before prayer",
    prayerFajrLabel: "Fajr",
    prayerDhuhrLabel: "Dhuhr",
    prayerAsrLabel: "Asr",
    prayerMaghribLabel: "Maghrib",
    prayerIshaLabel: "Isha",
    azkarIntervalLabel: "Azkar Interval (minutes)",
    hadithHourLabel: "Hadith Hour",
    hadithMinuteLabel: "Hadith Minute",
    hadithGradeLabel: "Hadith Grade",
    saveDmSettingsButton: "Save DM Settings",
    instantActionsTitle: "Instant Reminder Actions",
    sendNowAzkarDmButton: "Send Azkar Now (DM)",
    sendNowHadithDmButton: "Send Hadith Now (DM)",
    sendNowAzkarGuildButton: "Send Azkar Now",
    sendNowHadithGuildButton: "Send Hadith Now",
    instantAzkarSentDmFlash: "Instant azkar reminder sent to your DM.",
    instantHadithSentDmFlash: "Instant hadith reminder sent to your DM.",
    instantAzkarSentGuildFlash: "Instant azkar reminder sent to the configured channel.",
    instantHadithSentGuildFlash: "Instant hadith reminder sent to the configured channel.",
    instantAzkarSendFailedFlash: "Could not send azkar reminder now",
    instantHadithSendFailedFlash: "Could not send hadith reminder now",
    dataRightsTitle: "Data Controls",
    dataRightsDesc: "Export or delete your stored settings at any time.",
    exportDataButton: "Export My Data",
    deleteDataButton: "Delete My Data",
    deleteConfirmLabel: "Type DELETE to confirm",
    deleteConfirmPlaceholder: "DELETE",
    deleteProfileSuccessFlash: "Your stored data was deleted.",
    deleteProfileFailedFlash: "Could not delete your data",
    deleteGuildSuccessFlash: "Server data was deleted.",
    deleteGuildFailedFlash: "Could not delete server data",
    deleteServerDataButton: "Delete Server Data",
    serversConfigurableTitle: "Servers You Can Configure",
    serversConfigurableEmpty: "No manageable server found where the bot is already present.",
    configureButton: "Configure",
    serversInviteTitle: "Servers To Invite Bot",
    serversInviteEmpty: "No additional manageable servers found.",
    inviteHereButton: "Invite Here",
    idLabel: "ID",
    serverSettingsTitle: "Server Settings",
    serverSettingsDescription: "Everything configured here updates this server's bot behavior.",
    locationSectionTitle: "Location",
    adhanChannelsSectionTitle: "Adhan and Channels",
    prePrayerSectionTitle: "Pre-Prayer Reminders",
    reminderChannelLabel: "Reminder Channel",
    voiceChannelLabel: "Voice Channel",
    mentionRoleLabel: "Mention Role",
    playAdhanVoiceLabel: "Play Adhan in Voice Channel",
    enablePrePrayerLabel: "Enable Pre-Prayer Reminders",
    azkarSectionTitle: "Azkar Reminders",
    enableAzkarLabel: "Enable Azkar Reminders",
    intervalMinutesLabel: "Interval (minutes)",
    hadithSectionTitle: "Hadith Reminders",
    enableHadithLabel: "Enable Hadith Reminders",
    minimumGradeLabel: "Minimum Grade",
    saveServerSettingsButton: "Save Server Settings",
    backToDashboardButton: "Back to Dashboard",
    optionNotSet: "Not set",
    optionNone: "None"
  },
  arabic: {
    htmlLang: "ar",
    htmlDir: "rtl",
    brandTitle: "منبه الأذان",
    brandSubtitle: "لوحة تحكم بطابع رمضاني",
    inviteBot: "دعوة البوت",
    dashboard: "لوحة التحكم",
    logout: "تسجيل الخروج",
    loginWithDiscord: "تسجيل الدخول عبر ديسكورد",
    privacyPolicy: "سياسة الخصوصية",
    termsOfService: "شروط الخدمة",
    footerRights: "جميع الحقوق محفوظة.",
    languageAriaLabel: "لغة لوحة التحكم",
    themeAriaLabel: "المظهر",
    themeLightLabel: "فاتح",
    themeDarkLabel: "داكن",
    homeTitle: "تنبيهات الصلاة والأذكار والأحاديث والأذان الصوتي في مكان واحد",
    homeDescription:
      "اضبط كل شيء من الويب: موقع الصلاة، القنوات، تشغيل الصوت، رتبة المنشن، تذكيرات الخاص، فواصل الأذكار العشوائية، ووقت الحديث اليومي مع فلتر الدرجة.",
    homePrimaryCtaOpen: "فتح لوحة التحكم",
    homePrimaryCtaSetup: "يلزم إعداد تسجيل الدخول",
    featureGuildTitle: "تحكم السيرفر",
    featureGuildDesc: "اضبط القنوات، الأذان الصوتي، رتبة المنشن، وجميع جداول التذكير لكل سيرفر.",
    featureDmTitle: "لوحة الرسائل الخاصة",
    featureDmDesc: "إدارة موقعك الشخصي وتذكيرات الخاص للصلاة والأذكار والأحاديث.",
    featureStyleTitle: "هوية رمضانية",
    featureStyleDesc: "تصميم إسلامي هادئ بألوان ليلية ولمسات ذهبية.",
    personalDmSettingsTitle: "إعدادات الرسائل الخاصة",
    personalDmSettingsDesc: "هذه الإعدادات تتحكم بالتذكيرات التي تصلك في الرسائل الخاصة.",
    cityLabel: "المدينة",
    countryLabel: "الدولة",
    methodLabel: "طريقة الحساب",
    schoolLabel: "المذهب",
    cityPlaceholder: "مثال: بسكرة",
    countryPlaceholder: "مثال: الجزائر",
    dmPrayerRemindersLabel: "تذكيرات الصلاة في الخاص",
    dmAzkarRemindersLabel: "تذكيرات الأذكار في الخاص",
    dmAzkarHint: "يستخدم الفاصل الزمني أدناه.",
    dmHadithRemindersLabel: "تذكيرات الأحاديث في الخاص",
    dmHadithHint: "يستخدم الوقت اليومي أدناه.",
    globalLanguageLabel: "اللغة (العامة)",
    azkarIntervalLabel: "فاصل الأذكار (دقيقة)",
    hadithHourLabel: "ساعة الحديث",
    hadithMinuteLabel: "دقيقة الحديث",
    hadithGradeLabel: "درجة الحديث",
    saveDmSettingsButton: "حفظ إعدادات الخاص",
    dataRightsTitle: "التحكم بالبيانات",
    dataRightsDesc: "يمكنك تصدير أو حذف إعداداتك المخزنة في أي وقت.",
    exportDataButton: "تصدير بياناتي",
    deleteDataButton: "حذف بياناتي",
    deleteConfirmLabel: "اكتب DELETE للتأكيد",
    deleteConfirmPlaceholder: "DELETE",
    deleteProfileSuccessFlash: "تم حذف بياناتك المخزنة.",
    deleteProfileFailedFlash: "تعذر حذف بياناتك",
    deleteGuildSuccessFlash: "تم حذف بيانات السيرفر.",
    deleteGuildFailedFlash: "تعذر حذف بيانات السيرفر",
    deleteServerDataButton: "حذف بيانات السيرفر",
    serversConfigurableTitle: "السيرفرات التي يمكنك ضبطها",
    serversConfigurableEmpty: "لا يوجد سيرفر قابل للإدارة ويوجد فيه البوت حالياً.",
    configureButton: "إعداد",
    serversInviteTitle: "سيرفرات تحتاج دعوة البوت",
    serversInviteEmpty: "لا توجد سيرفرات إضافية قابلة للإدارة.",
    inviteHereButton: "دعوة هنا",
    idLabel: "المعرف",
    serverSettingsTitle: "إعدادات السيرفر",
    serverSettingsDescription: "كل ما يتم ضبطه هنا يحدّث سلوك البوت في هذا السيرفر.",
    locationSectionTitle: "الموقع",
    adhanChannelsSectionTitle: "الأذان والقنوات",
    reminderChannelLabel: "قناة التذكير",
    voiceChannelLabel: "القناة الصوتية",
    mentionRoleLabel: "رتبة المنشن",
    playAdhanVoiceLabel: "تشغيل الأذان في القناة الصوتية",
    azkarSectionTitle: "تذكيرات الأذكار",
    enableAzkarLabel: "تفعيل تذكيرات الأذكار",
    intervalMinutesLabel: "الفاصل (دقيقة)",
    hadithSectionTitle: "تذكيرات الأحاديث",
    enableHadithLabel: "تفعيل تذكيرات الأحاديث",
    minimumGradeLabel: "أدنى درجة",
    saveServerSettingsButton: "حفظ إعدادات السيرفر",
    backToDashboardButton: "العودة إلى لوحة التحكم",
    optionNotSet: "غير مضبوط",
    optionNone: "بدون"
  }
};

const METHOD_LABELS_AR = {
  1: "جامعة كراتشي (1)",
  2: "إسنا (2)",
  3: "رابطة العالم الإسلامي (3)",
  4: "أم القرى - مكة (4)",
  5: "الهيئة المصرية العامة (5)",
  9: "الكويت (9)",
  10: "قطر (10)",
  11: "سنغافورة (11)",
  13: "تركيا (13)",
  15: "لجنة تحري الهلال (15)"
};

const SCHOOL_LABELS_AR = {
  0: "شافعي/مالكي/حنبلي (0)",
  1: "حنفي (1)"
};

const HADITH_GRADE_OPTION_LABELS_AR = {
  sahih: "صحيح فقط",
  hasan: "صحيح وحسن",
  weak: "يشمل الضعيف"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDashboardLanguage(value) {
  return String(value || "english").trim().toLowerCase() === "arabic" ? "arabic" : "english";
}

function normalizeDashboardTheme(value) {
  return String(value || "dark").trim().toLowerCase() === "light" ? "light" : "dark";
}

function getDashboardI18n(language) {
  const normalized = normalizeDashboardLanguage(language);
  return {
    ...DASHBOARD_I18N.english,
    ...(DASHBOARD_I18N[normalized] || {})
  };
}

function getDashboardLanguage(req) {
  return normalizeDashboardLanguage(req?.session?.dashboardLanguage);
}

function getDashboardTheme(req) {
  return normalizeDashboardTheme(req?.session?.dashboardTheme);
}

function safeReturnPath(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "/";
  }

  try {
    const parsed = new URL(raw, "http://localhost");
    const nextPath = `${parsed.pathname || "/"}${parsed.search || ""}`;
    return nextPath.startsWith("/") ? nextPath : "/";
  } catch {
    return "/";
  }
}

function boolFromCheckbox(value) {
  return value === "on" || value === "true" || value === "1";
}

function parseBoundedInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizePrePrayerLeadMinutes(value, fallback = DEFAULT_PRE_PRAYER_LEAD_MINUTES) {
  const parsed = parseBoundedInt(value, fallback, 5, 15);
  return PRE_PRAYER_LEAD_CHOICES.includes(parsed) ? parsed : DEFAULT_PRE_PRAYER_LEAD_MINUTES;
}

function normalizePrePrayerSelections(value) {
  const source = value && typeof value === "object" ? value : {};
  const selections = {};
  for (const prayerKey of PRE_PRAYER_KEYS) {
    selections[prayerKey] = source[prayerKey] !== false;
  }
  return selections;
}

function ensureAtLeastOnePrayerSelected(value) {
  const normalized = normalizePrePrayerSelections(value);
  if (PRE_PRAYER_KEYS.some((prayerKey) => normalized[prayerKey])) {
    return normalized;
  }
  return normalizePrePrayerSelections({});
}

function parsePrePrayerSelectionsFromBody(body, prefix) {
  const selections = {};
  for (const prayerKey of PRE_PRAYER_KEYS) {
    selections[prayerKey] = boolFromCheckbox(body[`${prefix}${prayerKey}`]);
  }
  return selections;
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

function withRoleMention(config, content) {
  const roleMention = config?.mentionRoleId ? `<@&${config.mentionRoleId}> ` : "";
  return `${roleMention}${content}`;
}

function reminderContentCopy(language) {
  const normalized = normalizeContentLanguage(language);
  if (normalized === "arabic") {
    return {
      azkarTitle: "\u062a\u0630\u0643\u064a\u0631 \u0623\u0630\u0643\u0627\u0631",
      hadithTitle: "\u062a\u0630\u0643\u064a\u0631 \u062d\u062f\u064a\u062b",
      sourceLabel: "\u0627\u0644\u0645\u0635\u062f\u0631"
    };
  }
  return {
    azkarTitle: "Azkar Reminder",
    hadithTitle: "Hadith Reminder",
    sourceLabel: "Source"
  };
}

function buildAzkarReminderContent(entry, language) {
  const copy = reminderContentCopy(language);
  const text = getEntryTextByLanguage(entry, language);
  return `✨ **${copy.azkarTitle}**\n## ✨ ${text} ✨\n> 📖 **${copy.sourceLabel}:** ${entry.source}`;
}

function buildHadithReminderContent(entry, language) {
  const copy = reminderContentCopy(language);
  const text = getEntryTextByLanguage(entry, language);
  return `📖 **${copy.hadithTitle}**\n## ✨ ${text} ✨\n> 📖 **${copy.sourceLabel}:** ${entry.source}`;
}

async function sendGuildInstantAzkar({ client, config }) {
  const reminderChannel = await client.channels.fetch(config.reminderChannelId).catch(() => null);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    throw new Error("Reminder channel was not found or is not text-based.");
  }

  const language = resolveConfigLanguage(config);
  const { entry, nextRecentIds } = getRandomAzkar({
    recentIds: config.recentAzkarIds,
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  const message = buildAzkarReminderContent(entry, language);
  await reminderChannel.send({ content: withRoleMention(config, message) });
  return { nextRecentIds };
}

async function sendGuildInstantHadith({ client, config }) {
  const reminderChannel = await client.channels.fetch(config.reminderChannelId).catch(() => null);
  if (!reminderChannel || !reminderChannel.isTextBased()) {
    throw new Error("Reminder channel was not found or is not text-based.");
  }

  const language = resolveConfigLanguage(config);
  const { entry, nextRecentIds } = getRandomHadith({
    recentIds: config.recentHadithIds,
    minGrade: normalizeHadithGrade(config.hadithMinGrade),
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  const message = buildHadithReminderContent(entry, language);
  await reminderChannel.send({ content: withRoleMention(config, message) });
  return { nextRecentIds };
}

async function sendUserInstantAzkarDm({ client, userId, config }) {
  const user = client.users.cache.get(userId) || (await client.users.fetch(userId).catch(() => null));
  if (!user) {
    throw new Error("User not found.");
  }

  const language = resolveConfigLanguage(config, { dm: true });
  const { entry, nextRecentIds } = getRandomAzkar({
    recentIds: config.recentAzkarIds,
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  await user.send({ content: buildAzkarReminderContent(entry, language) });
  return { nextRecentIds };
}

async function sendUserInstantHadithDm({ client, userId, config }) {
  const user = client.users.cache.get(userId) || (await client.users.fetch(userId).catch(() => null));
  if (!user) {
    throw new Error("User not found.");
  }

  const language = resolveConfigLanguage(config, { dm: true });
  const { entry, nextRecentIds } = getRandomHadith({
    recentIds: config.recentHadithIds,
    minGrade: normalizeHadithGrade(config.dmHadithMinGrade),
    maxHistory: RECENT_CONTENT_HISTORY_SIZE
  });

  await user.send({ content: buildHadithReminderContent(entry, language) });
  return { nextRecentIds };
}

function parseReminderTimeString(value, fallback = DEFAULT_HADITH_TIME) {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return fallback;
}

function parseReminderTimeFromFields(hourValue, minuteValue, fallback = DEFAULT_HADITH_TIME) {
  const [fallbackHour, fallbackMinute] = parseReminderTimeString(fallback).split(":").map(Number);
  const hour = parseBoundedInt(hourValue, fallbackHour, 0, 23);
  const minute = parseBoundedInt(minuteValue, fallbackMinute, 0, 59);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function splitTimeForForm(value) {
  const normalized = parseReminderTimeString(value);
  const [hour, minute] = normalized.split(":").map(Number);
  return { hour, minute };
}

function normalizeIdField(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function inviteUrl({ clientId, permissions, guildId }) {
  if (!clientId) {
    return "#";
  }
  const endpoint = new URL("https://discord.com/api/oauth2/authorize");
  endpoint.searchParams.set("client_id", clientId);
  endpoint.searchParams.set("scope", "bot applications.commands");
  endpoint.searchParams.set("permissions", String(permissions));
  if (guildId) {
    endpoint.searchParams.set("guild_id", guildId);
    endpoint.searchParams.set("disable_guild_select", "true");
  }
  return endpoint.toString();
}

function avatarUrl(discordUser) {
  if (!discordUser?.id || !discordUser?.avatar) {
    return null;
  }
  return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`;
}

function isManageableGuild(guild) {
  if (!guild) {
    return false;
  }
  if (guild.owner === true) {
    return true;
  }
  try {
    const permissions = BigInt(guild.permissions || "0");
    return (permissions & MANAGE_GUILD_FLAG) === MANAGE_GUILD_FLAG;
  } catch {
    return false;
  }
}

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  return req.session.csrfToken;
}

function verifyCsrf(req) {
  const expected = req.session.csrfToken;
  const actual = String(req.body.csrf_token || "");
  return Boolean(expected && actual && expected === actual);
}

function setFlash(req, type, text) {
  req.session.flash = { type, text };
}

function consumeFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

function optionTag({ value, label, selected }) {
  const selectedAttr = selected ? " selected" : "";
  return `<option value="${escapeHtml(value)}"${selectedAttr}>${escapeHtml(label)}</option>`;
}

function contentLanguageOptions(selectedValue, dashboardLanguage = "english") {
  const normalizedSelected = normalizeContentLanguage(selectedValue);
  const normalizedDashboardLanguage = normalizeDashboardLanguage(dashboardLanguage);
  return CONTENT_LANGUAGE_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label:
        normalizedDashboardLanguage === "arabic"
          ? choice.value === "arabic"
            ? "العربية"
            : "الإنجليزية"
          : choice.name,
      selected: normalizedSelected === choice.value
    })
  ).join("");
}

function methodChoiceLabel(choice, dashboardLanguage) {
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  if (normalized === "arabic") {
    return METHOD_LABELS_AR[choice.value] || choice.name;
  }
  return choice.name;
}

function schoolChoiceLabel(choice, dashboardLanguage) {
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  if (normalized === "arabic") {
    return SCHOOL_LABELS_AR[choice.value] || choice.name;
  }
  return choice.name;
}

function hadithGradeChoiceLabel(choice, dashboardLanguage) {
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  if (normalized === "arabic") {
    return HADITH_GRADE_OPTION_LABELS_AR[choice.value] || choice.name;
  }
  return choice.name;
}

function dashboardPrayerLabel(prayerKey, dashboardLanguage, i18n) {
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  const fromI18n = i18n?.[`prayer${prayerKey[0].toUpperCase()}${prayerKey.slice(1)}Label`];
  if (typeof fromI18n === "string" && fromI18n.trim()) {
    return fromI18n;
  }
  return DASHBOARD_PRAYER_LABELS[normalized]?.[prayerKey] || DASHBOARD_PRAYER_LABELS.english[prayerKey] || prayerKey;
}

function prePrayerLeadOptions(selectedValue, dashboardLanguage, i18n) {
  const selected = normalizePrePrayerLeadMinutes(selectedValue);
  return PRE_PRAYER_LEAD_CHOICES.map((minutes) =>
    optionTag({
      value: minutes,
      label: `${minutes} ${i18n.beforePrayerSuffix}`,
      selected: selected === minutes
    })
  ).join("");
}

function prePrayerSelectionGrid({ prefix, selectedMap, dashboardLanguage, i18n }) {
  const normalized = normalizePrePrayerSelections(selectedMap);
  return `
    <div class="prayer-grid">
      ${PRE_PRAYER_KEYS.map((prayerKey) => {
        const checkedAttr = normalized[prayerKey] ? " checked" : "";
        const emoji = DASHBOARD_PRAYER_EMOJIS[prayerKey] || "";
        const label = dashboardPrayerLabel(prayerKey, dashboardLanguage, i18n);
        return `
          <label class="prayer-pill">
            <input type="checkbox" name="${escapeHtml(`${prefix}${prayerKey}`)}"${checkedAttr} />
            <span>${escapeHtml(emoji)} ${escapeHtml(label)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function settingsInputRow({ label, name, value = "", placeholder = "", type = "text", min, max, required = false }) {
  const requiredAttr = required ? " required" : "";
  const minAttr = min !== undefined ? ` min="${escapeHtml(min)}"` : "";
  const maxAttr = max !== undefined ? ` max="${escapeHtml(max)}"` : "";
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${requiredAttr}${minAttr}${maxAttr} />
    </label>
  `;
}

function checkboxRow({ label, name, checked, hint }) {
  const checkedAttr = checked ? " checked" : "";
  const hintHtml = hint ? `<small>${escapeHtml(hint)}</small>` : "";
  return `
    <label class="check-row">
      <input type="checkbox" name="${escapeHtml(name)}"${checkedAttr} />
      <div>
        <strong>${escapeHtml(label)}</strong>
        ${hintHtml}
      </div>
    </label>
  `;
}

function renderLayout({
  title,
  content,
  user,
  inviteUrlValue,
  flash,
  dashboardLanguage,
  dashboardTheme = "dark",
  returnPath = "/"
}) {
  const userAvatar = avatarUrl(user);
  const logoUrl = "/assets/bot-icon-masjid.png";
  const normalizedLanguage = normalizeDashboardLanguage(dashboardLanguage);
  const normalizedTheme = normalizeDashboardTheme(dashboardTheme);
  const i18n = getDashboardI18n(normalizedLanguage);
  const languageOptions = DASHBOARD_LANGUAGE_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: choice.label,
      selected: normalizedLanguage === choice.value
    })
  ).join("");
  const languageSwitcher = `
    <form method="post" action="/dashboard/language" class="inline-form lang-form">
      <input type="hidden" name="return_to" value="${escapeHtml(returnPath)}" />
      <select
        class="lang-select"
        name="dashboard_language"
        aria-label="${escapeHtml(i18n.languageAriaLabel)}"
        onchange="this.form.submit()"
      >
        ${languageOptions}
      </select>
    </form>
  `;
  const themeCheckedAttr = normalizedTheme === "light" ? " checked" : "";
  const themeSwitcher = `
    <form method="post" action="/dashboard/theme" class="inline-form theme-form">
      <input type="hidden" name="return_to" value="${escapeHtml(returnPath)}" />
      <input type="hidden" name="theme" value="${escapeHtml(normalizedTheme)}" />
      <label class="switch" aria-label="${escapeHtml(i18n.themeAriaLabel)}">
        <input
          type="checkbox"
          ${themeCheckedAttr}
          onchange="this.form.theme.value=this.checked?'light':'dark'; this.form.submit();"
        />
        <span class="slider" aria-hidden="true"></span>
        <span class="switch-text">${escapeHtml(
          normalizedTheme === "light" ? i18n.themeLightLabel : i18n.themeDarkLabel
        )}</span>
      </label>
    </form>
  `;
  const authActions = user
    ? `
      <a class="btn btn-soft" href="/dashboard">${escapeHtml(i18n.dashboard)}</a>
      <form method="post" action="/auth/logout" class="inline-form">
        <button type="submit" class="btn btn-ghost">${escapeHtml(i18n.logout)}</button>
      </form>
    `
    : `<a class="btn btn-soft" href="/auth/discord">${escapeHtml(i18n.loginWithDiscord)}</a>`;
  const userBadge = user
    ? `<div class="user-badge">${userAvatar ? `<img src="${escapeHtml(userAvatar)}" alt="avatar" />` : ""}<span>${escapeHtml(user.username)}#${escapeHtml(user.discriminator)}</span></div>`
    : "";
  const flashHtml = flash ? `<div class="flash ${escapeHtml(flash.type)}">${escapeHtml(flash.text)}</div>` : "";
  const footerHtml = `
    <footer class="wrap footer">
      <div class="footer-links">
        <a href="/privacy">${escapeHtml(i18n.privacyPolicy)}</a>
        <span aria-hidden="true">•</span>
        <a href="/terms">${escapeHtml(i18n.termsOfService)}</a>
      </div>
      <p>© ${new Date().getFullYear()} ${escapeHtml(i18n.brandTitle)}. ${escapeHtml(i18n.footerRights)}</p>
    </footer>
  `;

  return `<!doctype html>
<html lang="${escapeHtml(i18n.htmlLang)}" dir="${escapeHtml(i18n.htmlDir)}" data-theme="${escapeHtml(
    normalizedTheme
  )}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{
      --font-sans:"Cairo",sans-serif;
      --font-serif:"Amiri",serif;
      --danger:#ff9f89;
    }
    html[data-theme="dark"]{
      color-scheme:dark;
      --gold:#e6cf8b;
      --gold-2:#f4df9e;
      --mint:#5ec4a8;
      --ink:#06263c;
      --text:#f4f8fb;
      --muted:#b6c7d4;
      --muted-2:#d9e6f3;
      --card:rgba(8,40,62,.78);
      --card-2:rgba(5,31,49,.55);
      --panel:rgba(5,31,49,.35);
      --field:rgba(2,21,35,.5);
      --field-2:rgba(2,21,35,.35);
      --border:rgba(230,207,139,.22);
      --border-2:rgba(230,207,139,.33);
      --shadow:0 18px 44px rgba(0,0,0,.28);
      --bg-a:radial-gradient(1200px 700px at 80% -10%, rgba(230,207,139,.22), transparent 60%);
      --bg-b:radial-gradient(900px 500px at 10% -10%, rgba(94,196,168,.16), transparent 60%);
      --bg-c:linear-gradient(180deg,#0f3a57,#041a2e);
      --brand-ring:rgba(8,40,62,.38);
      --brand-bg:#0c2f4a;
      --btn-soft-bg:rgba(94,196,168,.2);
      --btn-soft-border:rgba(94,196,168,.45);
      --btn-soft-text:#dbfff4;
    }
    html[data-theme="light"]{
      color-scheme:light;
      --gold:#b78b2f;
      --gold-2:#d1a84b;
      --mint:#1c8b73;
      --ink:#1b232c;
      --text:#1b232c;
      --muted:#50606e;
      --muted-2:#2c3945;
      --card:rgba(255,255,255,.86);
      --card-2:rgba(255,255,255,.72);
      --panel:rgba(255,255,255,.62);
      --field:#ffffff;
      --field-2:rgba(255,255,255,.72);
      --border:rgba(183,139,47,.22);
      --border-2:rgba(183,139,47,.28);
      --shadow:0 18px 44px rgba(15,26,36,.12);
      --bg-a:radial-gradient(900px 520px at 78% -10%, rgba(183,139,47,.18), transparent 62%);
      --bg-b:radial-gradient(840px 520px at 8% -10%, rgba(28,139,115,.10), transparent 62%);
      --bg-c:repeating-linear-gradient(135deg, rgba(183,139,47,.06) 0, rgba(183,139,47,.06) 1px, transparent 1px, transparent 14px);
      --bg-d:linear-gradient(180deg,#fffdf6,#f3ecd9);
      --brand-ring:rgba(183,139,47,.18);
      --brand-bg:rgba(255,255,255,.75);
      --btn-soft-bg:rgba(28,139,115,.10);
      --btn-soft-border:rgba(28,139,115,.28);
      --btn-soft-text:#1b232c;
    }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--text); font-family:var(--font-sans); background:var(--bg-a),var(--bg-b),var(--bg-c),var(--bg-d, none); min-height:100vh; }
    .wrap { width:min(1100px,94vw); margin:0 auto; }
    .topbar { display:flex; justify-content:space-between; gap:12px; padding:20px 0; align-items:center; }
    .brand { display:flex; align-items:center; gap:10px; text-decoration:none; }
    .brand-icon { width:44px; height:44px; border-radius:999px; border:1px solid rgba(230,207,139,.62); box-shadow:0 0 0 3px var(--brand-ring); background:var(--brand-bg); object-fit:cover; }
    .brand-text strong { font:700 1.3rem var(--font-serif); color:var(--gold-2); letter-spacing:.5px; display:block; }
    .brand-text span { color:var(--muted); font-size:.88rem; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:flex-end; }
    .lang-form { display:inline-flex; }
    .lang-select { border-radius:999px; border:1px solid rgba(230,207,139,.45); background:var(--field); color:var(--text); padding:9px 14px; font:700 .86rem var(--font-sans); }
    [dir="rtl"] .actions { justify-content:flex-start; }
    .btn { border:0; cursor:pointer; text-decoration:none; border-radius:999px; padding:10px 18px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }
    .btn-primary { background:linear-gradient(90deg,var(--gold),var(--gold-2)); color:var(--ink); }
    .btn-soft { background:var(--btn-soft-bg); color:var(--btn-soft-text); border:1px solid var(--btn-soft-border); }
    .btn-ghost { background:transparent; color:var(--text); border:1px solid rgba(230,207,139,.5); }
    .inline-form { display:inline; }
    .user-badge { display:inline-flex; align-items:center; gap:8px; border:1px solid rgba(230,207,139,.3); border-radius:999px; padding:6px 12px 6px 6px; background:var(--panel); }
    .user-badge img { width:26px; height:26px; border-radius:999px; border:1px solid rgba(230,207,139,.6); }
    .card { background:var(--card); border:1px solid var(--border); border-radius:20px; padding:24px; box-shadow:var(--shadow); backdrop-filter:saturate(120%) blur(10px); }
    .hero h1, .section-title { font-family:var(--font-serif); color:var(--gold-2); margin:0 0 10px; }
    .hero h1 { font-size:2.2rem; }
    .hero p, .subtle { color:var(--muted-2); line-height:1.5; margin:0; }
    .hero .cta-row { margin-top:18px; display:flex; gap:10px; flex-wrap:wrap; }
    .features { margin-top:18px; display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); }
    .feature { background:var(--card-2); border:1px solid rgba(230,207,139,.16); border-radius:16px; padding:14px; }
    .feature h3 { margin:0 0 6px; font-size:1rem; }
    .feature p { margin:0; color:var(--muted); font-size:.93rem; }
    .stack { display:grid; gap:12px; }
    .grid-2 { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); }
    .guild-list { display:grid; gap:10px; }
    .guild-item { display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid rgba(230,207,139,.2); border-radius:14px; padding:12px; background:var(--panel); }
    .guild-item h4 { margin:0; }
    .guild-item p { margin:2px 0 0; color:var(--muted); font-size:.85rem; }
    .form-grid { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); }
    .field { display:flex; flex-direction:column; gap:6px; }
    .field span { font-size:.85rem; font-weight:700; }
    .field input,.field select { border-radius:12px; border:1px solid var(--border-2); background:var(--field); color:var(--text); padding:10px 12px; font:600 .92rem var(--font-sans); }
    .field input:focus,.field select:focus { outline:3px solid rgba(230,207,139,.25); outline-offset:2px; }
    .check-row { display:flex; gap:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:var(--field-2); }
    .check-row small { color:var(--muted); }
    .prayer-grid { display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); }
    .prayer-pill { display:flex; align-items:center; gap:8px; border:1px solid var(--border); border-radius:12px; padding:9px 10px; background:var(--field-2); }
    .prayer-pill span { font-weight:700; color:var(--text); }
    .form-actions { margin-top:14px; display:flex; flex-wrap:wrap; gap:10px; }
    .flash { width:min(1100px,94vw); margin:0 auto 12px; border-radius:12px; padding:10px 14px; font-weight:700; }
    .flash.success { background:rgba(94,196,168,.22); color:var(--text); border:1px solid rgba(94,196,168,.5); }
    .flash.error { background:rgba(255,159,137,.2); color:var(--text); border:1px solid rgba(255,159,137,.55); }
    .footer { margin:22px auto 26px; text-align:center; color:var(--muted-2); font-size:.9rem; }
    .footer p { margin:8px 0 0; color:var(--muted); }
    .footer-links { display:inline-flex; gap:10px; align-items:center; }
    .footer-links a { color:var(--gold-2); text-decoration:none; }
    .footer-links a:hover { text-decoration:underline; }

    .switch { position:relative; display:inline-flex; align-items:center; gap:10px; padding:6px 12px; border-radius:999px; border:1px solid var(--border); background:var(--field-2); cursor:pointer; user-select:none; }
    .switch input { position:absolute; opacity:0; width:1px; height:1px; }
    .slider { width:44px; height:24px; border-radius:999px; background:rgba(230,207,139,.18); border:1px solid var(--border-2); position:relative; flex:0 0 auto; }
    html[data-theme="light"] .slider { background:rgba(183,139,47,.14); }
    .slider::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:999px; background:linear-gradient(180deg,var(--gold-2),var(--gold)); box-shadow:0 6px 16px rgba(0,0,0,.18); transition:transform .18s ease; }
    .switch input:checked + .slider::after { transform:translateX(20px); }
    .switch-text { font:700 .86rem var(--font-sans); color:var(--muted-2); }
    html[data-theme="light"] .switch-text { color:var(--muted-2); }
    html[data-theme="dark"] .switch-text { color:var(--muted-2); }
    @media (max-width:700px) { .hero h1{font-size:1.8rem;} .topbar{flex-direction:column;align-items:flex-start;} .actions{justify-content:flex-start;} }
  </style>
</head>
<body>
  <header class="wrap topbar">
    <a class="brand" href="/">
      <img class="brand-icon" src="${escapeHtml(logoUrl)}" alt="Adhan Reminder logo" />
      <span class="brand-text"><strong>${escapeHtml(i18n.brandTitle)}</strong><span>${escapeHtml(i18n.brandSubtitle)}</span></span>
    </a>
    <div class="actions">
      ${languageSwitcher}
      ${themeSwitcher}
      ${userBadge}
      <a class="btn btn-primary" href="${escapeHtml(inviteUrlValue)}">${escapeHtml(i18n.inviteBot)}</a>
      ${authActions}
    </div>
  </header>
  ${flashHtml}
  <main class="wrap stack">${content}</main>
  ${footerHtml}
</body>
</html>`;
}

function buildPrivacyContent(dashboardLanguage) {
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  const privacyContact = String(process.env.PRIVACY_CONTACT || "").trim();
  if (normalized === "arabic") {
    return `
      <section class="card">
        <h1 class="section-title">سياسة الخصوصية</h1>
        <p class="subtle">آخر تحديث: 2026-02-14</p>
        <div class="stack" style="margin-top:10px;">
          <p>يجمع بوت منبه الأذان الحد الأدنى من البيانات اللازمة لتشغيل الميزات وإعدادات لوحة التحكم.</p>
          <h3 class="section-title" style="font-size:1.1rem;">البيانات التي نخزنها</h3>
          <p>معرفات ديسكورد (المستخدم، السيرفر، القناة، الرتبة) وإعدادات التذكير (الموقع، اللغة، الأوقات).</p>
          <h3 class="section-title" style="font-size:1.1rem;">كيف نستخدم البيانات</h3>
          <p>لحساب مواقيت الصلاة، إرسال التذكيرات، تشغيل الأذان الصوتي، وإدارة تسجيل الدخول للوحة.</p>
          <h3 class="section-title" style="font-size:1.1rem;">مشاركة البيانات</h3>
          <p>لا نبيع بياناتك. قد تُرسل البيانات اللازمة فقط إلى Discord ومزود أوقات الصلاة لتقديم الخدمة.</p>
          <h3 class="section-title" style="font-size:1.1rem;">التحكم والحذف</h3>
          <p>يمكنك حذف بياناتك في أي وقت باستخدام أمر البوت <code>/delete-my-data</code> أو من لوحة التحكم (قسم التحكم بالبيانات).</p>
          <p>لمسح بيانات السيرفر (للمسؤولين): استخدم <code>/delete-guild-data</code>.</p>
          <h3 class="section-title" style="font-size:1.1rem;">التواصل</h3>
          <p>${privacyContact ? `للاستفسارات حول الخصوصية: ${escapeHtml(privacyContact)}.` : "للاستفسارات حول الخصوصية، تواصل مع مدير البوت."}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="card">
      <h1 class="section-title">Privacy Policy</h1>
      <p class="subtle">Last updated: 2026-02-14</p>
      <div class="stack" style="margin-top:10px;">
        <p>Adhan Reminder collects only the data required to run bot features and dashboard settings.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Data We Store</h3>
        <p>Discord IDs (user, guild, channel, role) and reminder settings (location, language, times).</p>
        <h3 class="section-title" style="font-size:1.1rem;">How We Use Data</h3>
        <p>To calculate prayer times, send reminders, play adhan in voice channels, and power dashboard login.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Data Sharing</h3>
        <p>We do not sell your data. Required data may be sent only to Discord and prayer-time providers to deliver service features.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Your Choices (Export / Delete)</h3>
        <p>You can export or delete your stored settings at any time from the dashboard (Data Controls section) or via bot commands.</p>
        <p>Personal data: <code>/export-my-data</code> and <code>/delete-my-data</code>.</p>
        <p>Server data (admins): <code>/delete-guild-data</code>.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Contact</h3>
        <p>${privacyContact ? `For privacy questions: ${escapeHtml(privacyContact)}.` : "For privacy questions, contact the bot administrator."}</p>
      </div>
    </section>
  `;
}

function buildTermsContent(dashboardLanguage) {
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  if (normalized === "arabic") {
    return `
      <section class="card">
        <h1 class="section-title">شروط الخدمة</h1>
        <p class="subtle">آخر تحديث: 2026-02-14</p>
        <div class="stack" style="margin-top:10px;">
          <p>باستخدامك لـ Adhan Reminder فأنت توافق على هذه الشروط.</p>
          <h3 class="section-title" style="font-size:1.1rem;">الاستخدام المسموح</h3>
          <p>يجب استخدام البوت فقط بما يتوافق مع شروط Discord وقوانين سيرفرك.</p>
          <h3 class="section-title" style="font-size:1.1rem;">توفر الخدمة</h3>
          <p>قد تتغير الخصائص أو تتوقف مؤقتًا دون إشعار مسبق.</p>
          <h3 class="section-title" style="font-size:1.1rem;">إبراء المسؤولية</h3>
          <p>الخدمة تُقدم "كما هي" دون ضمانات صريحة أو ضمنية.</p>
          <h3 class="section-title" style="font-size:1.1rem;">تحديث الشروط</h3>
          <p>قد نقوم بتحديث هذه الشروط، ويحل النص المحدث محل النسخ السابقة.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="card">
      <h1 class="section-title">Terms of Service</h1>
      <p class="subtle">Last updated: 2026-02-14</p>
      <div class="stack" style="margin-top:10px;">
        <p>By using Adhan Reminder, you agree to these terms.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Acceptable Use</h3>
        <p>Use the bot in compliance with Discord terms and your server rules.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Service Availability</h3>
        <p>Features may change, pause, or stop at any time.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Disclaimer</h3>
        <p>The service is provided "as is" without warranties.</p>
        <h3 class="section-title" style="font-size:1.1rem;">Changes to Terms</h3>
        <p>We may update these terms, and updated versions replace previous ones.</p>
      </div>
    </section>
  `;
}

function requireAuth(req, res, next) {
  if (!req.session.discordUser) {
    setFlash(req, "error", "Login with Discord first.");
    res.redirect("/");
    return;
  }
  next();
}

function buildHomeContent({ oauthEnabled, dashboardLanguage }) {
  const i18n = getDashboardI18n(dashboardLanguage);
  return `
    <section class="card hero">
      <h1>${escapeHtml(i18n.homeTitle)}</h1>
      <p>
        ${escapeHtml(i18n.homeDescription)}
      </p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/auth/discord">${escapeHtml(
          oauthEnabled ? i18n.homePrimaryCtaOpen : i18n.homePrimaryCtaSetup
        )}</a>
      </div>
      <div class="features">
        <article class="feature"><h3>${escapeHtml(i18n.featureGuildTitle)}</h3><p>${escapeHtml(
          i18n.featureGuildDesc
        )}</p></article>
        <article class="feature"><h3>${escapeHtml(i18n.featureDmTitle)}</h3><p>${escapeHtml(
          i18n.featureDmDesc
        )}</p></article>
        <article class="feature"><h3>${escapeHtml(i18n.featureStyleTitle)}</h3><p>${escapeHtml(
          i18n.featureStyleDesc
        )}</p></article>
      </div>
    </section>
  `;
}

function renderGuildListSection({ title, items, emptyMessage, makeAction, idLabel }) {
  const rows = items.length
    ? items
        .map((guild) => {
          const action = makeAction(guild);
          return `
            <article class="guild-item">
              <div>
                <h4>${escapeHtml(guild.name)}</h4>
                <p>${escapeHtml(idLabel)}: ${escapeHtml(guild.id)}</p>
              </div>
              ${action}
            </article>
          `;
        })
        .join("")
    : `<p class="subtle">${escapeHtml(emptyMessage)}</p>`;
  return `<section class="card"><h2 class="section-title">${escapeHtml(title)}</h2><div class="guild-list">${rows}</div></section>`;
}

function renderDashboardPage({ userConfig, manageableGuilds, inviteOnlyGuilds, csrfToken, dashboardLanguage }) {
  const i18n = getDashboardI18n(dashboardLanguage);
  const dmHadithTime = splitTimeForForm(userConfig.dmHadithReminderTime);
  const dmPrePrayerLeadOptionTags = prePrayerLeadOptions(userConfig.dmPrePrayerLeadMinutes, dashboardLanguage, i18n);
  const dmPrePrayerSelectionHtml = prePrayerSelectionGrid({
    prefix: "dmPrePrayer_",
    selectedMap: userConfig.dmPrePrayerSelections,
    dashboardLanguage,
    i18n
  });
  const dmLanguageOptions = contentLanguageOptions(
    userConfig.language || userConfig.dmAzkarLanguage || userConfig.dmHadithLanguage,
    dashboardLanguage
  );
  const methodOptions = METHOD_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: methodChoiceLabel(choice, dashboardLanguage),
      selected: Number(userConfig.location?.method ?? 3) === choice.value
    })
  ).join("");
  const schoolOptions = SCHOOL_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: schoolChoiceLabel(choice, dashboardLanguage),
      selected: Number(userConfig.location?.school ?? 0) === choice.value
    })
  ).join("");
  const hadithGradeOptions = HADITH_MIN_GRADE_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: hadithGradeChoiceLabel(choice, dashboardLanguage),
      selected: normalizeHadithGrade(userConfig.dmHadithMinGrade) === choice.value
    })
  ).join("");

  return `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.personalDmSettingsTitle)}</h2>
      <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
      <form method="post" action="/dashboard/profile">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <div class="form-grid">
          ${settingsInputRow({
            label: i18n.cityLabel,
            name: "city",
            value: userConfig.location?.city || "",
            placeholder: i18n.cityPlaceholder,
            required: true
          })}
          ${settingsInputRow({
            label: i18n.countryLabel,
            name: "country",
            value: userConfig.location?.country || "",
            placeholder: i18n.countryPlaceholder,
            required: true
          })}
          <label class="field"><span>${escapeHtml(i18n.methodLabel)}</span><select name="method">${methodOptions}</select></label>
          <label class="field"><span>${escapeHtml(i18n.schoolLabel)}</span><select name="school">${schoolOptions}</select></label>
        </div>
        <div class="stack" style="margin-top:10px;">
          ${checkboxRow({
            label: i18n.dmPrayerRemindersLabel,
            name: "dmRemindersEnabled",
            checked: userConfig.dmRemindersEnabled
          })}
          ${checkboxRow({
            label: i18n.dmPrePrayerRemindersLabel,
            name: "dmPrePrayerRemindersEnabled",
            checked: userConfig.dmPrePrayerRemindersEnabled,
            hint: i18n.dmPrePrayerHint
          })}
          ${checkboxRow({
            label: i18n.dmAzkarRemindersLabel,
            name: "dmAzkarRemindersEnabled",
            checked: userConfig.dmAzkarRemindersEnabled,
            hint: i18n.dmAzkarHint
          })}
          ${checkboxRow({
            label: i18n.dmHadithRemindersLabel,
            name: "dmHadithRemindersEnabled",
            checked: userConfig.dmHadithRemindersEnabled,
            hint: i18n.dmHadithHint
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <label class="field"><span>${escapeHtml(i18n.globalLanguageLabel)}</span><select name="language">${dmLanguageOptions}</select></label>
          <label class="field"><span>${escapeHtml(i18n.prePrayerLeadLabel)}</span><select name="dmPrePrayerLeadMinutes">${dmPrePrayerLeadOptionTags}</select></label>
          <label class="field" style="grid-column:1/-1;"><span>${escapeHtml(i18n.prePrayerPrayersLabel)}</span>${dmPrePrayerSelectionHtml}</label>
          ${settingsInputRow({
            label: i18n.azkarIntervalLabel,
            name: "dmAzkarIntervalMinutes",
            value: userConfig.dmAzkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES,
            type: "number",
            min: 30,
            max: 1440
          })}
          ${settingsInputRow({
            label: i18n.hadithHourLabel,
            name: "dmHadithHour",
            value: dmHadithTime.hour,
            type: "number",
            min: 0,
            max: 23
          })}
          ${settingsInputRow({
            label: i18n.hadithMinuteLabel,
            name: "dmHadithMinute",
            value: dmHadithTime.minute,
            type: "number",
            min: 0,
            max: 59
          })}
          <label class="field"><span>${escapeHtml(i18n.hadithGradeLabel)}</span><select name="dmHadithMinGrade">${hadithGradeOptions}</select></label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveDmSettingsButton)}</button>
        </div>
      </form>
      <h3 class="section-title" style="font-size:1.1rem;margin-top:18px;">${escapeHtml(i18n.instantActionsTitle)}</h3>
      <div class="form-actions">
        <form method="post" action="/dashboard/profile/instant-azkar" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-soft" type="submit">${escapeHtml(i18n.sendNowAzkarDmButton)}</button>
        </form>
        <form method="post" action="/dashboard/profile/instant-hadith" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-ghost" type="submit">${escapeHtml(i18n.sendNowHadithDmButton)}</button>
        </form>
      </div>

      <h3 class="section-title" style="font-size:1.1rem;margin-top:18px;">${escapeHtml(i18n.dataRightsTitle)}</h3>
      <p class="subtle">${escapeHtml(i18n.dataRightsDesc)}</p>
      <div class="form-actions">
        <a class="btn btn-soft" href="/dashboard/profile/export">${escapeHtml(i18n.exportDataButton)}</a>
        <form method="post" action="/dashboard/profile/delete-data" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <input
            name="confirm"
            placeholder="${escapeHtml(i18n.deleteConfirmPlaceholder)}"
            aria-label="${escapeHtml(i18n.deleteConfirmLabel)}"
            pattern="DELETE"
            required
            style="max-width:220px;"
          />
          <button class="btn btn-ghost" type="submit">${escapeHtml(i18n.deleteDataButton)}</button>
        </form>
      </div>
    </section>
    <div class="grid-2">
      ${renderGuildListSection({
        title: i18n.serversConfigurableTitle,
        items: manageableGuilds,
        emptyMessage: i18n.serversConfigurableEmpty,
        idLabel: i18n.idLabel,
        makeAction: (guild) =>
          `<a class="btn btn-soft" href="/dashboard/guild/${escapeHtml(guild.id)}">${escapeHtml(i18n.configureButton)}</a>`
      })}
      ${renderGuildListSection({
        title: i18n.serversInviteTitle,
        items: inviteOnlyGuilds,
        emptyMessage: i18n.serversInviteEmpty,
        idLabel: i18n.idLabel,
        makeAction: (guild) =>
          `<a class="btn btn-ghost" href="${escapeHtml(guild.inviteUrl)}">${escapeHtml(i18n.inviteHereButton)}</a>`
      })}
    </div>
  `;
}

function renderGuildSettingsPage({ guild, guildConfig, textChannels, voiceChannels, roles, csrfToken, dashboardLanguage }) {
  const i18n = getDashboardI18n(dashboardLanguage);
  const hadithTime = splitTimeForForm(guildConfig.hadithReminderTime);
  const prePrayerLeadOptionTags = prePrayerLeadOptions(guildConfig.prePrayerLeadMinutes, dashboardLanguage, i18n);
  const prePrayerSelectionHtml = prePrayerSelectionGrid({
    prefix: "prePrayer_",
    selectedMap: guildConfig.prePrayerSelections,
    dashboardLanguage,
    i18n
  });
  const globalLanguageOptions = contentLanguageOptions(
    guildConfig.language || guildConfig.azkarLanguage || guildConfig.hadithLanguage,
    dashboardLanguage
  );
  const methodOptions = METHOD_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: methodChoiceLabel(choice, dashboardLanguage),
      selected: Number(guildConfig.location?.method ?? 3) === choice.value
    })
  ).join("");
  const schoolOptions = SCHOOL_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: schoolChoiceLabel(choice, dashboardLanguage),
      selected: Number(guildConfig.location?.school ?? 0) === choice.value
    })
  ).join("");
  const textChannelOptions = [optionTag({ value: "", label: i18n.optionNotSet, selected: !guildConfig.reminderChannelId })]
    .concat(
      textChannels.map((channel) =>
        optionTag({
          value: channel.id,
          label: `#${channel.name}`,
          selected: guildConfig.reminderChannelId === channel.id
        })
      )
    )
    .join("");
  const voiceChannelOptions = [optionTag({ value: "", label: i18n.optionNotSet, selected: !guildConfig.adhanVoiceChannelId })]
    .concat(
      voiceChannels.map((channel) =>
        optionTag({
          value: channel.id,
          label: channel.name,
          selected: guildConfig.adhanVoiceChannelId === channel.id
        })
      )
    )
    .join("");
  const roleOptions = [optionTag({ value: "", label: i18n.optionNone, selected: !guildConfig.mentionRoleId })]
    .concat(
      roles.map((role) =>
        optionTag({
          value: role.id,
          label: role.name,
          selected: guildConfig.mentionRoleId === role.id
        })
      )
    )
    .join("");
  const hadithGradeOptions = HADITH_MIN_GRADE_CHOICES.map((choice) =>
    optionTag({
      value: choice.value,
      label: hadithGradeChoiceLabel(choice, dashboardLanguage),
      selected: normalizeHadithGrade(guildConfig.hadithMinGrade) === choice.value
    })
  ).join("");

  return `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.serverSettingsTitle)}: ${escapeHtml(guild.name)}</h2>
      <p class="subtle">${escapeHtml(i18n.serverSettingsDescription)}</p>
      <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <h3 class="section-title" style="font-size:1.15rem;margin-top:18px;">${escapeHtml(i18n.locationSectionTitle)}</h3>
        <div class="form-grid">
          ${settingsInputRow({
            label: i18n.cityLabel,
            name: "city",
            value: guildConfig.location?.city || "",
            placeholder: i18n.cityPlaceholder,
            required: true
          })}
          ${settingsInputRow({
            label: i18n.countryLabel,
            name: "country",
            value: guildConfig.location?.country || "",
            placeholder: i18n.countryPlaceholder,
            required: true
          })}
          <label class="field"><span>${escapeHtml(i18n.methodLabel)}</span><select name="method">${methodOptions}</select></label>
          <label class="field"><span>${escapeHtml(i18n.schoolLabel)}</span><select name="school">${schoolOptions}</select></label>
        </div>

        <h3 class="section-title" style="font-size:1.15rem;margin-top:18px;">${escapeHtml(i18n.adhanChannelsSectionTitle)}</h3>
        <div class="form-grid">
          <label class="field"><span>${escapeHtml(i18n.reminderChannelLabel)}</span><select name="reminderChannelId">${textChannelOptions}</select></label>
          <label class="field"><span>${escapeHtml(i18n.voiceChannelLabel)}</span><select name="adhanVoiceChannelId">${voiceChannelOptions}</select></label>
          <label class="field"><span>${escapeHtml(i18n.mentionRoleLabel)}</span><select name="mentionRoleId">${roleOptions}</select></label>
        </div>
        <div class="stack" style="margin-top:10px;">
          ${checkboxRow({
            label: i18n.playAdhanVoiceLabel,
            name: "playAdhanInVoice",
            checked: guildConfig.playAdhanInVoice
          })}
        </div>

        <h3 class="section-title" style="font-size:1.15rem;margin-top:18px;">${escapeHtml(i18n.prePrayerSectionTitle)}</h3>
        <div class="stack">
          ${checkboxRow({
            label: i18n.enablePrePrayerLabel,
            name: "prePrayerRemindersEnabled",
            checked: guildConfig.prePrayerRemindersEnabled
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <label class="field"><span>${escapeHtml(i18n.prePrayerLeadLabel)}</span><select name="prePrayerLeadMinutes">${prePrayerLeadOptionTags}</select></label>
          <label class="field" style="grid-column:1/-1;"><span>${escapeHtml(i18n.prePrayerPrayersLabel)}</span>${prePrayerSelectionHtml}</label>
        </div>

        <h3 class="section-title" style="font-size:1.15rem;margin-top:18px;">${escapeHtml(i18n.azkarSectionTitle)}</h3>
        <div class="stack">
          ${checkboxRow({
            label: i18n.enableAzkarLabel,
            name: "azkarRemindersEnabled",
            checked: guildConfig.azkarRemindersEnabled
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <label class="field"><span>${escapeHtml(i18n.globalLanguageLabel)}</span><select name="language">${globalLanguageOptions}</select></label>
          ${settingsInputRow({
            label: i18n.intervalMinutesLabel,
            name: "azkarIntervalMinutes",
            value: guildConfig.azkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES,
            type: "number",
            min: 30,
            max: 1440
          })}
        </div>

        <h3 class="section-title" style="font-size:1.15rem;margin-top:18px;">${escapeHtml(i18n.hadithSectionTitle)}</h3>
        <div class="stack">
          ${checkboxRow({
            label: i18n.enableHadithLabel,
            name: "hadithRemindersEnabled",
            checked: guildConfig.hadithRemindersEnabled
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          ${settingsInputRow({
            label: i18n.hadithHourLabel,
            name: "hadithHour",
            value: hadithTime.hour,
            type: "number",
            min: 0,
            max: 23
          })}
          ${settingsInputRow({
            label: i18n.hadithMinuteLabel,
            name: "hadithMinute",
            value: hadithTime.minute,
            type: "number",
            min: 0,
            max: 59
          })}
          <label class="field"><span>${escapeHtml(i18n.minimumGradeLabel)}</span><select name="hadithMinGrade">${hadithGradeOptions}</select></label>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveServerSettingsButton)}</button>
          <a class="btn btn-soft" href="/dashboard">${escapeHtml(i18n.backToDashboardButton)}</a>
        </div>
      </form>
      <h3 class="section-title" style="font-size:1.1rem;margin-top:18px;">${escapeHtml(i18n.instantActionsTitle)}</h3>
      <div class="form-actions">
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/instant-azkar" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-soft" type="submit">${escapeHtml(i18n.sendNowAzkarGuildButton)}</button>
        </form>
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/instant-hadith" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-ghost" type="submit">${escapeHtml(i18n.sendNowHadithGuildButton)}</button>
        </form>
      </div>
      <h3 class="section-title" style="font-size:1.1rem;margin-top:18px;">${escapeHtml(i18n.dataRightsTitle)}</h3>
      <p class="subtle">${escapeHtml(i18n.dataRightsDesc)}</p>
      <div class="form-actions">
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/delete-data" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <input
            name="confirm"
            placeholder="${escapeHtml(i18n.deleteConfirmPlaceholder)}"
            aria-label="${escapeHtml(i18n.deleteConfirmLabel)}"
            pattern="DELETE"
            required
            style="max-width:220px;"
          />
          <button class="btn btn-ghost" type="submit">${escapeHtml(i18n.deleteServerDataButton)}</button>
        </form>
      </div>
    </section>
  `;
}

function parseRetryAfterMs(retryAfterValue) {
  const parsed = Number(retryAfterValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 1000);
}

function hasDiscordCache(sessionData) {
  return Boolean(sessionData?.discordUser?.id && Array.isArray(sessionData?.discordGuilds));
}

async function fetchDiscordJson(endpoint, accessToken) {
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    if (response.status === 429) {
      const payload = await response.json().catch(() => null);
      const fromHeaderMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const fromPayloadMs = parseRetryAfterMs(payload?.retry_after);
      const retryAfterMs = Math.max(fromHeaderMs, fromPayloadMs);
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      const error = new Error(`Discord API rate limited. Try again in about ${retryAfterSec}s.`);
      error.code = "DISCORD_RATELIMIT";
      error.retryAfterMs = retryAfterMs;
      throw error;
    }

    const payload = await response.json().catch(() => null);
    const message = typeof payload?.message === "string" ? `: ${payload.message}` : "";
    throw new Error(`Discord API failed (${response.status})${message}`);
  }
  return response.json();
}

async function refreshDiscordSession(req, options = {}) {
  const force = options.force === true;
  const accessToken = req.session.oauthAccessToken;
  if (!accessToken) {
    return false;
  }

  const now = Date.now();
  const lastSyncedAt = Number(req.session.discordSessionSyncedAt || 0);
  if (!force && hasDiscordCache(req.session) && now - lastSyncedAt < DISCORD_SYNC_TTL_MS) {
    return true;
  }

  try {
    const [user, guilds] = await Promise.all([
      fetchDiscordJson("https://discord.com/api/users/@me", accessToken),
      fetchDiscordJson("https://discord.com/api/users/@me/guilds", accessToken)
    ]);
    req.session.discordUser = user;
    req.session.discordGuilds = Array.isArray(guilds) ? guilds : [];
    req.session.discordSessionSyncedAt = now;
    return true;
  } catch (error) {
    if (hasDiscordCache(req.session)) {
      if (error.code === "DISCORD_RATELIMIT") {
        req.session.discordSessionRateLimitedUntil = Date.now() + (error.retryAfterMs || 0);
      }
      return true;
    }
    throw error;
  }
}

function splitUserGuildsForDashboard(discordGuilds, botGuildIds, clientId, botPermissions) {
  const manageable = [];
  const inviteOnly = [];

  for (const guild of discordGuilds) {
    if (!isManageableGuild(guild)) {
      continue;
    }
    if (botGuildIds.has(guild.id)) {
      manageable.push(guild);
    } else {
      inviteOnly.push({
        ...guild,
        inviteUrl: inviteUrl({
          clientId,
          permissions: botPermissions,
          guildId: guild.id
        })
      });
    }
  }

  manageable.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  inviteOnly.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { manageable, inviteOnly };
}

async function startDashboardServer({ client, guildStore, userStore }) {
  const app = express();
  const webPort = Number(process.env.WEB_PORT || 3000);
  const webBaseUrl = String(process.env.WEB_BASE_URL || `http://localhost:${webPort}`).replace(/\/+$/, "");
  const sessionCookieDomain = String(process.env.SESSION_COOKIE_DOMAIN || "").trim();
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const botPermissions = Number(process.env.BOT_PERMISSIONS || 2322443439053888);
  const oauthEnabled = Boolean(clientId && clientSecret);
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET missing; generated temporary secret for this runtime.");
  }

  app.set("trust proxy", 1);
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      name: "adhan.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // Mark session cookies as secure when the public-facing base URL is HTTPS.
        // This helps in production behind a reverse proxy (nginx) while still working on localhost.
        secure: webBaseUrl.startsWith("https://"),
        // Optional: share the session across subdomains (e.g. www + apex) to avoid OAuth state mismatch.
        ...(sessionCookieDomain ? { domain: sessionCookieDomain } : {}),
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    })
  );
  app.use("/assets", express.static(path.join(__dirname, "..", "assets")));

  app.post("/dashboard/language", (req, res) => {
    const nextLanguage = normalizeDashboardLanguage(req.body.dashboard_language);
    req.session.dashboardLanguage = nextLanguage;
    const returnPath = safeReturnPath(req.body.return_to || req.get("referer") || "/");
    res.redirect(returnPath);
  });

  app.post("/dashboard/theme", (req, res) => {
    const nextTheme = normalizeDashboardTheme(req.body.theme);
    req.session.dashboardTheme = nextTheme;
    const returnPath = safeReturnPath(req.body.return_to || req.get("referer") || "/");
    res.redirect(returnPath);
  });

  app.get("/", (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const dashboardTheme = getDashboardTheme(req);
    const flash = consumeFlash(req);
    const content = buildHomeContent({ oauthEnabled, dashboardLanguage });
    const html = renderLayout({
      title: "Adhan Reminder Dashboard",
      content,
      user: req.session.discordUser || null,
      inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
      flash,
      dashboardLanguage,
      dashboardTheme,
      returnPath: req.originalUrl || "/"
    });
    res.status(200).send(html);
  });

  app.get("/privacy", (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const dashboardTheme = getDashboardTheme(req);
    const html = renderLayout({
      title: dashboardLanguage === "arabic" ? "سياسة الخصوصية" : "Privacy Policy",
      content: buildPrivacyContent(dashboardLanguage),
      user: req.session.discordUser || null,
      inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
      flash: consumeFlash(req),
      dashboardLanguage,
      dashboardTheme,
      returnPath: req.originalUrl || "/privacy"
    });
    res.status(200).send(html);
  });

  app.get("/terms", (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const dashboardTheme = getDashboardTheme(req);
    const html = renderLayout({
      title: dashboardLanguage === "arabic" ? "شروط الخدمة" : "Terms of Service",
      content: buildTermsContent(dashboardLanguage),
      user: req.session.discordUser || null,
      inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
      flash: consumeFlash(req),
      dashboardLanguage,
      dashboardTheme,
      returnPath: req.originalUrl || "/terms"
    });
    res.status(200).send(html);
  });

  app.get("/auth/discord", (req, res) => {
    if (!oauthEnabled) {
      setFlash(req, "error", "Missing CLIENT_ID or CLIENT_SECRET in .env for dashboard login.");
      res.redirect("/");
      return;
    }
    const state = crypto.randomBytes(20).toString("hex");
    req.session.oauthState = state;
    const endpoint = new URL("https://discord.com/api/oauth2/authorize");
    endpoint.searchParams.set("client_id", clientId);
    endpoint.searchParams.set("response_type", "code");
    endpoint.searchParams.set("scope", "identify guilds");
    endpoint.searchParams.set("redirect_uri", `${webBaseUrl}/auth/callback`);
    endpoint.searchParams.set("state", state);
    res.redirect(endpoint.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      if (!oauthEnabled) {
        setFlash(req, "error", "OAuth is not configured.");
        res.redirect("/");
        return;
      }
      const { code, state } = req.query;
      if (!code || !state || state !== req.session.oauthState) {
        setFlash(req, "error", "Invalid OAuth callback state.");
        res.redirect("/");
        return;
      }

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: `${webBaseUrl}/auth/callback`
      });

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed with HTTP ${tokenResponse.status}`);
      }
      const tokenJson = await tokenResponse.json();
      if (!tokenJson.access_token) {
        throw new Error("Discord token response did not include access_token.");
      }

      req.session.oauthAccessToken = tokenJson.access_token;
      await refreshDiscordSession(req, { force: true });
      setFlash(req, "success", "Logged in with Discord.");
      res.redirect("/dashboard");
    } catch (error) {
      setFlash(req, "error", `Login failed: ${error.message}`);
      res.redirect("/");
    }
  });

  app.post("/auth/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });

  app.get("/dashboard", requireAuth, async (req, res) => {
    try {
      const dashboardLanguage = getDashboardLanguage(req);
      const dashboardTheme = getDashboardTheme(req);
      await refreshDiscordSession(req);
      const userId = req.session.discordUser.id;
      const userConfig = userStore.getUserConfig(userId);
      const botGuildIds = new Set([...client.guilds.cache.keys(), ...Object.keys(guildStore.getAllConfigs())]);
      const { manageable, inviteOnly } = splitUserGuildsForDashboard(
        req.session.discordGuilds || [],
        botGuildIds,
        clientId,
        botPermissions
      );
      const content = renderDashboardPage({
        userConfig,
        manageableGuilds: manageable,
        inviteOnlyGuilds: inviteOnly,
        csrfToken: ensureCsrfToken(req),
        dashboardLanguage
      });
      const html = renderLayout({
        title: "Dashboard",
        content,
        user: req.session.discordUser,
        inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
        flash: consumeFlash(req),
        dashboardLanguage,
        dashboardTheme,
        returnPath: req.originalUrl || "/dashboard"
      });
      res.status(200).send(html);
    } catch (error) {
      setFlash(req, "error", `Failed to load dashboard: ${error.message}`);
      res.redirect("/");
    }
  });

  app.post("/dashboard/profile", requireAuth, async (req, res) => {
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect("/dashboard");
      return;
    }

    try {
      const userId = req.session.discordUser.id;
      const current = userStore.getUserConfig(userId);
      const city = String(req.body.city || "").trim();
      const country = String(req.body.country || "").trim();
      const method = parseBoundedInt(req.body.method, Number(current.location?.method ?? 3), 0, 99);
      const school = parseBoundedInt(req.body.school, Number(current.location?.school ?? 0), 0, 1);
      const resolvedLocation = await resolveCityCountryLocation({ city, country, method, school });

      const dmRemindersEnabled = boolFromCheckbox(req.body.dmRemindersEnabled);
      const dmPrePrayerRemindersEnabled = boolFromCheckbox(req.body.dmPrePrayerRemindersEnabled);
      const dmAzkarRemindersEnabled = boolFromCheckbox(req.body.dmAzkarRemindersEnabled);
      const dmHadithRemindersEnabled = boolFromCheckbox(req.body.dmHadithRemindersEnabled);
      const dmPrePrayerLeadMinutes = normalizePrePrayerLeadMinutes(
        req.body.dmPrePrayerLeadMinutes,
        Number(current.dmPrePrayerLeadMinutes ?? DEFAULT_PRE_PRAYER_LEAD_MINUTES)
      );
      const dmPrePrayerSelections = ensureAtLeastOnePrayerSelected(
        parsePrePrayerSelectionsFromBody(req.body, "dmPrePrayer_")
      );
      const dmAzkarIntervalMinutes = parseBoundedInt(
        req.body.dmAzkarIntervalMinutes,
        Number(current.dmAzkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES),
        30,
        1440
      );
      const language = normalizeContentLanguage(req.body.language || current.language);
      const dmHadithReminderTime = parseReminderTimeFromFields(
        req.body.dmHadithHour,
        req.body.dmHadithMinute,
        current.dmHadithReminderTime
      );
      const dmHadithMinGrade = normalizeHadithGrade(req.body.dmHadithMinGrade || current.dmHadithMinGrade);

      userStore.updateUserConfig(userId, (draft) => {
        draft.location = resolvedLocation;
        draft.dmRemindersEnabled = dmRemindersEnabled;
        draft.dmPrePrayerRemindersEnabled = dmPrePrayerRemindersEnabled;
        draft.dmPrePrayerLeadMinutes = dmPrePrayerLeadMinutes;
        draft.dmPrePrayerSelections = dmPrePrayerSelections;
        draft.dmAzkarRemindersEnabled = dmAzkarRemindersEnabled;
        draft.dmHadithRemindersEnabled = dmHadithRemindersEnabled;
        draft.language = language;
        draft.dmAzkarIntervalMinutes = dmAzkarIntervalMinutes;
        draft.dmAzkarLanguage = language;
        draft.dmHadithReminderTime = dmHadithReminderTime;
        draft.dmHadithMinGrade = dmHadithMinGrade;
        draft.dmHadithLanguage = language;
        if (dmAzkarRemindersEnabled) {
          draft.dmAzkarLastSentAt = null;
        }
        if (dmHadithRemindersEnabled) {
          draft.dmHadithLastTriggeredDate = null;
        }
        if (dmPrePrayerRemindersEnabled) {
          draft.dmPrePrayerLastTriggered = {};
        }
        if (dmRemindersEnabled) {
          draft.lastTriggered = {};
        }
        return draft;
      });

      setFlash(req, "success", "Personal DM settings saved.");
      res.redirect("/dashboard");
    } catch (error) {
      setFlash(req, "error", `Could not save personal settings: ${error.message}`);
      res.redirect("/dashboard");
    }
  });

  app.post("/dashboard/profile/instant-azkar", requireAuth, async (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const i18n = getDashboardI18n(dashboardLanguage);
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect("/dashboard");
      return;
    }

    try {
      const userId = req.session.discordUser.id;
      const config = userStore.getUserConfig(userId);
      const { nextRecentIds } = await sendUserInstantAzkarDm({ client, userId, config });
      userStore.updateUserConfig(userId, (draft) => {
        draft.recentAzkarIds = nextRecentIds;
        draft.dmAzkarLastSentAt = new Date().toISOString();
        return draft;
      });
      setFlash(req, "success", i18n.instantAzkarSentDmFlash);
    } catch (error) {
      setFlash(req, "error", `${i18n.instantAzkarSendFailedFlash}: ${error.message}`);
    }
    res.redirect("/dashboard");
  });

  app.post("/dashboard/profile/instant-hadith", requireAuth, async (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const i18n = getDashboardI18n(dashboardLanguage);
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect("/dashboard");
      return;
    }

    try {
      const userId = req.session.discordUser.id;
      const config = userStore.getUserConfig(userId);
      const { nextRecentIds } = await sendUserInstantHadithDm({ client, userId, config });
      userStore.updateUserConfig(userId, (draft) => {
        draft.recentHadithIds = nextRecentIds;
        return draft;
      });
      setFlash(req, "success", i18n.instantHadithSentDmFlash);
    } catch (error) {
      setFlash(req, "error", `${i18n.instantHadithSendFailedFlash}: ${error.message}`);
    }
    res.redirect("/dashboard");
  });

  app.get("/dashboard/profile/export", requireAuth, (req, res) => {
    const userId = req.session.discordUser.id;
    const exportConfig = userStore.getUserConfig(userId);
    const payload = `${JSON.stringify(exportConfig, null, 2)}\n`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"adhan-reminder-user-${userId}.json\"`);
    res.status(200).send(payload);
  });

  app.post("/dashboard/profile/delete-data", requireAuth, (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const i18n = getDashboardI18n(dashboardLanguage);
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect("/dashboard");
      return;
    }

    const confirm = String(req.body.confirm || "").trim().toUpperCase();
    if (confirm !== "DELETE") {
      setFlash(req, "error", "Confirmation was not provided.");
      res.redirect("/dashboard");
      return;
    }

    const userId = req.session.discordUser.id;
    userStore.deleteUserConfig(userId);
    setFlash(req, "success", i18n.deleteProfileSuccessFlash);
    res.redirect("/dashboard");
  });

  app.get("/dashboard/guild/:guildId", requireAuth, async (req, res) => {
    try {
      const dashboardLanguage = getDashboardLanguage(req);
      const dashboardTheme = getDashboardTheme(req);
      await refreshDiscordSession(req);
      const guildId = req.params.guildId;
      const botGuildIds = new Set([...client.guilds.cache.keys(), ...Object.keys(guildStore.getAllConfigs())]);
      const { manageable } = splitUserGuildsForDashboard(
        req.session.discordGuilds || [],
        botGuildIds,
        clientId,
        botPermissions
      );
      if (!manageable.some((guild) => guild.id === guildId)) {
        setFlash(req, "error", "You do not have permission to manage that server.");
        res.redirect("/dashboard");
        return;
      }

      const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) {
        setFlash(req, "error", "Bot is not in that server.");
        res.redirect("/dashboard");
        return;
      }

      const channels = await guild.channels.fetch().catch(() => null);
      const roles = await guild.roles.fetch().catch(() => null);
      const textChannels = [...(channels?.values() || [])]
        .filter((channel) => channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement))
        .sort((a, b) => a.rawPosition - b.rawPosition);
      const voiceChannels = [...(channels?.values() || [])]
        .filter((channel) => channel && (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice))
        .sort((a, b) => a.rawPosition - b.rawPosition);
      const selectableRoles = [...(roles?.values() || [])]
        .filter((role) => role && !role.managed && role.name !== "@everyone")
        .sort((a, b) => b.position - a.position);

      const guildConfig = guildStore.getGuildConfig(guildId);
      const content = renderGuildSettingsPage({
        guild,
        guildConfig,
        textChannels,
        voiceChannels,
        roles: selectableRoles,
        csrfToken: ensureCsrfToken(req),
        dashboardLanguage
      });

      const html = renderLayout({
        title: `Guild Dashboard - ${guild.name}`,
        content,
        user: req.session.discordUser,
        inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
        flash: consumeFlash(req),
        dashboardLanguage,
        dashboardTheme,
        returnPath: req.originalUrl || `/dashboard/guild/${guildId}`
      });
      res.status(200).send(html);
    } catch (error) {
      setFlash(req, "error", `Failed to load server page: ${error.message}`);
      res.redirect("/dashboard");
    }
  });

  app.post("/dashboard/guild/:guildId", requireAuth, async (req, res) => {
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${req.params.guildId}`);
      return;
    }

    const guildId = req.params.guildId;
    try {
      await refreshDiscordSession(req);
      const botGuildIds = new Set([...client.guilds.cache.keys(), ...Object.keys(guildStore.getAllConfigs())]);
      const { manageable } = splitUserGuildsForDashboard(
        req.session.discordGuilds || [],
        botGuildIds,
        clientId,
        botPermissions
      );
      if (!manageable.some((guild) => guild.id === guildId)) {
        setFlash(req, "error", "You do not have permission to update that server.");
        res.redirect("/dashboard");
        return;
      }

      const current = guildStore.getGuildConfig(guildId);
      const city = String(req.body.city || "").trim();
      const country = String(req.body.country || "").trim();
      const method = parseBoundedInt(req.body.method, Number(current.location?.method ?? 3), 0, 99);
      const school = parseBoundedInt(req.body.school, Number(current.location?.school ?? 0), 0, 1);
      const resolvedLocation = await resolveCityCountryLocation({ city, country, method, school });

      const reminderChannelId = normalizeIdField(req.body.reminderChannelId);
      const adhanVoiceChannelId = normalizeIdField(req.body.adhanVoiceChannelId);
      const mentionRoleId = normalizeIdField(req.body.mentionRoleId);
      const playAdhanInVoice = boolFromCheckbox(req.body.playAdhanInVoice);
      const prePrayerRemindersEnabled = boolFromCheckbox(req.body.prePrayerRemindersEnabled);
      const prePrayerLeadMinutes = normalizePrePrayerLeadMinutes(
        req.body.prePrayerLeadMinutes,
        Number(current.prePrayerLeadMinutes ?? DEFAULT_PRE_PRAYER_LEAD_MINUTES)
      );
      const prePrayerSelections = ensureAtLeastOnePrayerSelected(
        parsePrePrayerSelectionsFromBody(req.body, "prePrayer_")
      );

      const azkarRemindersEnabled = boolFromCheckbox(req.body.azkarRemindersEnabled);
      const azkarIntervalMinutes = parseBoundedInt(
        req.body.azkarIntervalMinutes,
        Number(current.azkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES),
        30,
        1440
      );
      const language = normalizeContentLanguage(req.body.language || current.language);

      const hadithRemindersEnabled = boolFromCheckbox(req.body.hadithRemindersEnabled);
      const hadithReminderTime = parseReminderTimeFromFields(
        req.body.hadithHour,
        req.body.hadithMinute,
        current.hadithReminderTime
      );
      const hadithMinGrade = normalizeHadithGrade(req.body.hadithMinGrade || current.hadithMinGrade);

      if (playAdhanInVoice && !adhanVoiceChannelId) {
        throw new Error("Voice playback is enabled but no voice channel is selected.");
      }
      if ((prePrayerRemindersEnabled || azkarRemindersEnabled || hadithRemindersEnabled) && !reminderChannelId) {
        throw new Error("Choose a reminder channel before enabling pre-prayer/azkar/hadith reminders.");
      }

      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.location = resolvedLocation;
        draft.reminderChannelId = reminderChannelId;
        draft.adhanVoiceChannelId = adhanVoiceChannelId;
        draft.playAdhanInVoice = Boolean(playAdhanInVoice && adhanVoiceChannelId);
        draft.mentionRoleId = mentionRoleId;
        draft.language = language;
        draft.prePrayerRemindersEnabled = prePrayerRemindersEnabled;
        draft.prePrayerLeadMinutes = prePrayerLeadMinutes;
        draft.prePrayerSelections = prePrayerSelections;
        draft.azkarRemindersEnabled = azkarRemindersEnabled;
        draft.azkarIntervalMinutes = azkarIntervalMinutes;
        draft.azkarLanguage = language;
        draft.hadithRemindersEnabled = hadithRemindersEnabled;
        draft.hadithReminderTime = hadithReminderTime;
        draft.hadithMinGrade = hadithMinGrade;
        draft.hadithLanguage = language;
        if (azkarRemindersEnabled) {
          draft.azkarLastSentAt = null;
        }
        if (hadithRemindersEnabled) {
          draft.hadithLastTriggeredDate = null;
        }
        if (prePrayerRemindersEnabled) {
          draft.prePrayerLastTriggered = {};
        }
        return draft;
      });

      setFlash(req, "success", "Server settings saved.");
      res.redirect(`/dashboard/guild/${guildId}`);
    } catch (error) {
      setFlash(req, "error", `Could not save server settings: ${error.message}`);
      res.redirect(`/dashboard/guild/${guildId}`);
    }
  });

  app.post("/dashboard/guild/:guildId/instant-azkar", requireAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const dashboardLanguage = getDashboardLanguage(req);
    const i18n = getDashboardI18n(dashboardLanguage);
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${guildId}`);
      return;
    }

    try {
      await refreshDiscordSession(req);
      const botGuildIds = new Set([...client.guilds.cache.keys(), ...Object.keys(guildStore.getAllConfigs())]);
      const { manageable } = splitUserGuildsForDashboard(
        req.session.discordGuilds || [],
        botGuildIds,
        clientId,
        botPermissions
      );
      if (!manageable.some((guild) => guild.id === guildId)) {
        throw new Error("You do not have permission to update that server.");
      }

      const config = guildStore.getGuildConfig(guildId);
      if (!config.reminderChannelId) {
        throw new Error("Reminder channel is not configured for this server.");
      }
      const { nextRecentIds } = await sendGuildInstantAzkar({ client, config });
      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.recentAzkarIds = nextRecentIds;
        draft.azkarLastSentAt = new Date().toISOString();
        return draft;
      });
      setFlash(req, "success", i18n.instantAzkarSentGuildFlash);
    } catch (error) {
      setFlash(req, "error", `${i18n.instantAzkarSendFailedFlash}: ${error.message}`);
    }
    res.redirect(`/dashboard/guild/${guildId}`);
  });

  app.post("/dashboard/guild/:guildId/instant-hadith", requireAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const dashboardLanguage = getDashboardLanguage(req);
    const i18n = getDashboardI18n(dashboardLanguage);
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${guildId}`);
      return;
    }

    try {
      await refreshDiscordSession(req);
      const botGuildIds = new Set([...client.guilds.cache.keys(), ...Object.keys(guildStore.getAllConfigs())]);
      const { manageable } = splitUserGuildsForDashboard(
        req.session.discordGuilds || [],
        botGuildIds,
        clientId,
        botPermissions
      );
      if (!manageable.some((guild) => guild.id === guildId)) {
        throw new Error("You do not have permission to update that server.");
      }

      const config = guildStore.getGuildConfig(guildId);
      if (!config.reminderChannelId) {
        throw new Error("Reminder channel is not configured for this server.");
      }
      const { nextRecentIds } = await sendGuildInstantHadith({ client, config });
      guildStore.updateGuildConfig(guildId, (draft) => {
        draft.recentHadithIds = nextRecentIds;
        return draft;
      });
      setFlash(req, "success", i18n.instantHadithSentGuildFlash);
    } catch (error) {
      setFlash(req, "error", `${i18n.instantHadithSendFailedFlash}: ${error.message}`);
    }
    res.redirect(`/dashboard/guild/${guildId}`);
  });

  app.post("/dashboard/guild/:guildId/delete-data", requireAuth, async (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const i18n = getDashboardI18n(dashboardLanguage);
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${req.params.guildId}`);
      return;
    }

    const confirm = String(req.body.confirm || "").trim().toUpperCase();
    if (confirm !== "DELETE") {
      setFlash(req, "error", "Confirmation was not provided.");
      res.redirect(`/dashboard/guild/${req.params.guildId}`);
      return;
    }

    try {
      await refreshDiscordSession(req);
      const guildId = req.params.guildId;
      const botGuildIds = new Set([...client.guilds.cache.keys(), ...Object.keys(guildStore.getAllConfigs())]);
      const { manageable } = splitUserGuildsForDashboard(
        req.session.discordGuilds || [],
        botGuildIds,
        clientId,
        botPermissions
      );
      if (!manageable.some((guild) => guild.id === guildId)) {
        setFlash(req, "error", "You do not have permission to manage that server.");
        res.redirect("/dashboard");
        return;
      }

      guildStore.deleteGuildConfig(guildId);
      setFlash(req, "success", i18n.deleteGuildSuccessFlash);
      res.redirect("/dashboard");
    } catch (error) {
      setFlash(req, "error", `${i18n.deleteGuildFailedFlash}: ${error.message}`);
      res.redirect(`/dashboard/guild/${req.params.guildId}`);
    }
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use((_req, res) => {
    res.status(404).send("Not Found");
  });

  app.listen(webPort, () => {
    console.log(`Dashboard running at ${webBaseUrl} (port ${webPort})`);
  });
}

module.exports = {
  startDashboardServer
};


