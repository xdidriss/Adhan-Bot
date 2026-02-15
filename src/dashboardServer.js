const crypto = require("node:crypto");
const path = require("node:path");
const discordJs = require("discord.js");
const { ChannelType, PermissionsBitField } = discordJs;
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
const { getEveryAyahReciters, getQaris, getSurahs } = require("./quranSources");

if (!ChannelType || !PermissionsBitField?.Flags) {
  const version = discordJs?.version ? String(discordJs.version) : "unknown";
  throw new Error(
    `Incompatible discord.js version (${version}). This project requires discord.js v14.x. ` +
      `Fix: run "npm install" in the project root (or reinstall discord.js@14).`
  );
}

const MANAGE_GUILD_FLAG = BigInt(PermissionsBitField.Flags.ManageGuild);
const DEFAULT_HADITH_TIME = "20:00";
const DEFAULT_AZKAR_INTERVAL_MINUTES = 180;
const RECENT_CONTENT_HISTORY_SIZE = 12;
const DEFAULT_PRE_PRAYER_LEAD_MINUTES = 10;
const PRE_PRAYER_LEAD_CHOICES = [5, 10, 15];
const PRE_PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const QURAN_QARI_PRESETS = [
  { id: 5, label: "Mishari Rashid al-`Afasy" },
  { id: 7, label: "Abdur-Rahman as-Sudais" },
  { id: 65, label: "Maher al-Muaiqly" },
  { id: 14, label: "Abdul Baset Abdul Samad" },
  { id: 10, label: "Mahmoud Khalil Al-Husary" },
  { id: 6, label: "Sa`ud ash-Shuraym" }
];
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
    addAsApp: "Add as App",
    dashboard: "Dashboard",
    logout: "Logout",
    loginWithDiscord: "Login with Discord",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    footerRights: "All rights reserved.",
    footerTeamCreditsLine: "Team Sandid — Credits: Idriss, Ayoub, Jimbe",
    footerContactTitle: "Contact",
    footerContactOwnerLabel: "Owner",
    footerContactOwnerName: "Idriss",
    footerContactEmailLabel: "Email",
    languageAriaLabel: "Dashboard language",
    themeAriaLabel: "Theme",
    themeLightLabel: "Light",
    themeDarkLabel: "Dark",
    sectionsTitle: "Sections",
    sectionLocation: "Location",
    sectionChannels: "Channels",
    sectionPrePrayer: "Before Prayer",
    sectionAzkar: "Azkar",
    sectionHadith: "Hadith",
    sectionQuranRadio: "Quran 24/7",
    sectionQuranAyah: "Ayah Playback",
    sectionLanguage: "Language",
    sectionReminders: "Reminders",
    sectionSchedule: "Schedule",
    sectionServers: "Servers",
    sectionInstant: "Instant Actions",
    sectionData: "Data Controls",
    homeTitle: "Prayer reminders, azkar, hadith, and voice adhan in one place",
    homeDescription:
      "Configure everything from the web: prayer location, reminder channels, role mentions, pre-prayer alerts, azkar/hadith intervals with grade filtering, and Quran voice playback.",
    homePrimaryCtaOpen: "Open Dashboard",
    homePrimaryCtaSetup: "Login setup required",
    featurePrayerTitle: "Prayer Times + Adhan",
    featurePrayerDesc: "Prayer times by city/country with adhan reminders and optional pre-prayer alerts.",
    featureRemindersTitle: "Azkar + Hadith Reminders",
    featureRemindersDesc: "Interval-based azkar and hadith reminders, with a minimum hadith grade filter.",
    featureVoiceTitle: "Voice Playback",
    featureVoiceDesc: "Play adhan in a voice channel, or start Quran 24/7 / play a surah / play an ayah range.",
    featureDashboardTitle: "Dashboard + Data Controls",
    featureDashboardDesc: "Configure each server and your personal DM settings. Export or delete stored settings anytime.",
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
    dmHadithHint: "Uses the hadith interval below.",
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
    azkarIntervalLabel: "Azkar Interval",
    hadithIntervalLabel: "Hadith Interval",
    intervalDailyOptionLabel: "Daily (use time below)",
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
    intervalMinutesLabel: "Interval",
    hadithSectionTitle: "Hadith Reminders",
    enableHadithLabel: "Enable Hadith Reminders",
    minimumGradeLabel: "Minimum Grade",
    quranRadioSectionTitle: "Quran 24/7 (Voice)",
    quranRadioSectionDesc: "Continuous Quran recitation (surah order) using QuranicAudio full surah files.",
    quranAyahSectionTitle: "Ayah Playback (Voice)",
    quranAyahSectionDesc: "Play a specific surah and ayah range using the EveryAyah verse-by-verse dataset.",
    enableQuranRadioLabel: "Enable Quran 24/7",
    quranVoiceChannelLabel: "Quran Voice Channel",
    quranReciterLabel: "Reciter (QuranicAudio)",
    quranEveryAyahReciterLabel: "Ayah Reciter Key (EveryAyah)",
    quranVolumeLabel: "Volume (0% - 100%)",
    quranSurahLabel: "Surah",
    quranAyahFromLabel: "From Ayah",
    quranAyahToLabel: "To Ayah",
    quranStatusLabel: "Quran Status",
    quranStatusStopped: "Stopped",
    quranStatusRadio: "Radio (24/7)",
    quranStatusSurah: "Playing Surah",
    quranStatusAyah: "Playing Ayah Range",
    startRadioButton: "Start 24/7 Now",
    stopRadioButton: "Stop Radio",
    playSurahButton: "Play Surah Now",
    playAyahButton: "Play Ayah Range Now",
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
    addAsApp: "إضافة كتطبيق",
    dashboard: "لوحة التحكم",
    logout: "تسجيل الخروج",
    loginWithDiscord: "تسجيل الدخول عبر ديسكورد",
    privacyPolicy: "سياسة الخصوصية",
    termsOfService: "شروط الخدمة",
    footerRights: "جميع الحقوق محفوظة.",
    footerTeamCreditsLine: "فريق سانديد — الشكر: إدريس، أيوب، جيمبي",
    footerContactTitle: "تواصل",
    footerContactOwnerLabel: "المالك",
    footerContactOwnerName: "إدريس",
    footerContactEmailLabel: "البريد",
    languageAriaLabel: "لغة لوحة التحكم",
    themeAriaLabel: "المظهر",
    themeLightLabel: "فاتح",
    themeDarkLabel: "داكن",
    sectionsTitle: "الأقسام",
    sectionLocation: "الموقع",
    sectionChannels: "القنوات",
    sectionPrePrayer: "قبل الصلاة",
    sectionAzkar: "الأذكار",
    sectionHadith: "الأحاديث",
    sectionQuranRadio: "القرآن 24/7",
    sectionQuranAyah: "تشغيل الآيات",
    sectionLanguage: "اللغة",
    sectionReminders: "التذكيرات",
    sectionSchedule: "الجدول",
    sectionServers: "السيرفرات",
    sectionInstant: "إرسال فوري",
    sectionData: "البيانات",
    homeTitle: "تنبيهات الصلاة والأذكار والأحاديث والأذان الصوتي في مكان واحد",
    homeDescription:
      "اضبط كل شيء من الويب: موقع الصلاة، قنوات التذكير، رتبة المنشن، تنبيهات قبل الصلاة، فواصل الأذكار والأحاديث مع فلتر الدرجة، وتشغيل القرآن بالصوت.",
    homePrimaryCtaOpen: "فتح لوحة التحكم",
    homePrimaryCtaSetup: "يلزم إعداد تسجيل الدخول",
    featurePrayerTitle: "مواقيت الصلاة والأذان",
    featurePrayerDesc: "مواقيت حسب المدينة/الدولة مع تنبيهات الأذان وتنبيهات قبل الصلاة اختيارياً.",
    featureRemindersTitle: "الأذكار والأحاديث",
    featureRemindersDesc: "تذكيرات بفاصل زمني للأذكار والأحاديث، مع فلتر أدنى درجة للحديث.",
    featureVoiceTitle: "التشغيل الصوتي",
    featureVoiceDesc: "تشغيل الأذان في قناة صوتية، أو تشغيل القرآن 24/7 / سورة كاملة / نطاق آيات.",
    featureDashboardTitle: "لوحة التحكم والبيانات",
    featureDashboardDesc: "إعدادات لكل سيرفر وإعدادات الخاص. تصدير أو حذف بيانات الإعدادات في أي وقت.",
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
    dmHadithHint: "يستخدم فاصل الحديث بالأسفل.",
    globalLanguageLabel: "اللغة (العامة)",
    azkarIntervalLabel: "فاصل الأذكار",
    hadithIntervalLabel: "فاصل الحديث",
    intervalDailyOptionLabel: "يوميًا (استخدم الوقت أدناه)",
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
    intervalMinutesLabel: "الفاصل",
    hadithSectionTitle: "تذكيرات الأحاديث",
    enableHadithLabel: "تفعيل تذكيرات الأحاديث",
    minimumGradeLabel: "أدنى درجة",
    quranRadioSectionTitle: "القرآن 24/7 (صوت)",
    quranRadioSectionDesc: "تلاوة مستمرة (حسب ترتيب المصحف) باستخدام ملفات السور الكاملة من QuranicAudio.",
    quranAyahSectionTitle: "تشغيل الآيات (صوت)",
    quranAyahSectionDesc: "تشغيل سورة ونطاق آيات باستخدام مكتبة EveryAyah آية بآية.",
    enableQuranRadioLabel: "تفعيل القرآن 24/7",
    quranVoiceChannelLabel: "قناة القرآن الصوتية",
    quranReciterLabel: "القارئ (QuranicAudio)",
    quranEveryAyahReciterLabel: "مفتاح القارئ (EveryAyah)",
    quranVolumeLabel: "الصوت (0% - 100%)",
    quranSurahLabel: "السورة",
    quranAyahFromLabel: "من آية",
    quranAyahToLabel: "إلى آية",
    quranStatusLabel: "حالة القرآن",
    quranStatusStopped: "متوقف",
    quranStatusRadio: "مستمر (24/7)",
    quranStatusSurah: "تشغيل سورة",
    quranStatusAyah: "تشغيل نطاق آيات",
    startRadioButton: "تشغيل 24/7 الآن",
    stopRadioButton: "إيقاف",
    playSurahButton: "تشغيل السورة الآن",
    playAyahButton: "تشغيل الآيات الآن",
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

const DASHBOARD_LANG_COOKIE = "adhan.dashboard_lang";
const DASHBOARD_THEME_COOKIE = "adhan.dashboard_theme";

function getCookieValue(req, name) {
  const header = String(req?.headers?.cookie || "");
  if (!header) {
    return "";
  }
  const parts = header.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k !== name) continue;
    const v = part.slice(eq + 1);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return "";
}

function appendSetCookie(res, cookieValue) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [existing, cookieValue]);
}

function setCookie(res, name, value, { maxAgeSeconds, secure, domain } = {}) {
  const encoded = encodeURIComponent(String(value ?? ""));
  const attributes = [
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
    `Max-Age=${Number.isFinite(maxAgeSeconds) ? Math.max(0, Math.floor(maxAgeSeconds)) : 31536000}`
  ];
  if (secure) attributes.push("Secure");
  if (domain) attributes.push(`Domain=${domain}`);
  appendSetCookie(res, `${name}=${encoded}; ${attributes.join("; ")}`);
}

function normalizeDashboardLanguage(value) {
  return String(value || "english").trim().toLowerCase() === "arabic" ? "arabic" : "english";
}

function normalizeDashboardTheme(value) {
  return String(value || "dark").trim().toLowerCase() === "light" ? "light" : "dark";
}

const DASHBOARD_PROFILE_SECTION_KEYS = [
  "servers",
  "dm-location",
  "dm-language",
  "dm-reminders",
  "dm-schedule",
  "dm-instant",
  "dm-data"
];
function normalizeDashboardProfileSection(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return DASHBOARD_PROFILE_SECTION_KEYS.includes(normalized) ? normalized : "servers";
}

const DASHBOARD_GUILD_SECTION_KEYS = [
  "quran-radio",
  "quran-ayah",
  "language",
  "location",
  "channels",
  "preprayer",
  "azkar",
  "hadith",
  "instant",
  "data"
];
function normalizeDashboardGuildSection(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "quran") return "quran-radio";
  return DASHBOARD_GUILD_SECTION_KEYS.includes(normalized) ? normalized : "location";
}

const REMINDER_INTERVAL_CHOICES_MINUTES = [30, 45, 60, 90, 120, 180, 360];
function reminderIntervalChoiceLabel(minutesValue, dashboardLanguage) {
  const minutes = Number(minutesValue);
  const normalized = normalizeDashboardLanguage(dashboardLanguage);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return normalized === "arabic" ? "افتراضي" : "Default";
  }

  if (normalized === "arabic") {
    if (minutes < 60) return `${minutes} دقيقة`;
    if (minutes === 60) return "ساعة";
    if (minutes === 90) return "ساعة ونصف";
    if (minutes === 120) return "ساعتان";
    return `${minutes / 60} ساعات`;
  }

  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return "1 hour";
  if (minutes === 90) return "1 hour 30 minutes";
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

function reminderIntervalOptions(selectedValue, dashboardLanguage) {
  const selected = Number(selectedValue);
  const selectedIsValid = Number.isFinite(selected);
  return REMINDER_INTERVAL_CHOICES_MINUTES.map((minutes) =>
    optionTag({
      value: minutes,
      label: reminderIntervalChoiceLabel(minutes, dashboardLanguage),
      selected: selectedIsValid ? selected === minutes : minutes === 180
    })
  ).join("");
}

function parseOptionalIntervalMinutes(value, fallbackValue = null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.min(1440, Math.max(30, Math.round(parsed)));
}

function hasValidLocation(config) {
  const location = config?.location;
  return (
    location &&
    typeof location.timezone === "string" &&
    location.timezone.trim().length > 0 &&
    ((typeof location.city === "string" &&
      location.city.trim().length > 0 &&
      typeof location.country === "string" &&
      location.country.trim().length > 0) ||
      (typeof location.latitude === "number" && typeof location.longitude === "number"))
  );
}

function getDashboardI18n(language) {
  const normalized = normalizeDashboardLanguage(language);
  return {
    ...DASHBOARD_I18N.english,
    ...(DASHBOARD_I18N[normalized] || {})
  };
}

function getDashboardLanguage(req) {
  const fromSession = req?.session?.dashboardLanguage;
  if (fromSession) {
    return normalizeDashboardLanguage(fromSession);
  }
  return normalizeDashboardLanguage(getCookieValue(req, DASHBOARD_LANG_COOKIE));
}

function getDashboardTheme(req) {
  const fromSession = req?.session?.dashboardTheme;
  if (fromSession) {
    return normalizeDashboardTheme(fromSession);
  }
  return normalizeDashboardTheme(getCookieValue(req, DASHBOARD_THEME_COOKIE));
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

function normalizeVolume01FromPercent(value, fallback = 0.35) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.min(1, Number(fallback) || 0.35));
  }
  // Backwards compat: old UI submitted 0.0-1.0, new slider submits 0-100.
  const normalized = parsed > 1 ? parsed / 100 : parsed;
  return Math.max(0, Math.min(1, normalized));
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
  return `## ✨ ${text} ✨\n> 📖 **${copy.sourceLabel}:** ${entry.source}`;
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

function addAsAppUrl({ clientId }) {
  if (!clientId) {
    return "#";
  }
  const endpoint = new URL("https://discord.com/api/oauth2/authorize");
  endpoint.searchParams.set("client_id", clientId);
  // "Add as App" = install app commands to the user (Discord's user install flow).
  endpoint.searchParams.set("scope", "applications.commands");
  endpoint.searchParams.set("integration_type", "1");
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
  addAsAppUrlValue,
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
      <div class="footer-grid">
        <div class="footer-links">
          <a href="/privacy">${escapeHtml(i18n.privacyPolicy)}</a>
          <span aria-hidden="true">•</span>
          <a href="/terms">${escapeHtml(i18n.termsOfService)}</a>
        </div>
        <div class="footer-card" aria-label="${escapeHtml(i18n.footerContactTitle)}">
          <div class="footer-card-title">${escapeHtml(i18n.footerContactTitle)}</div>
          <div class="footer-card-body">
            <div><strong>${escapeHtml(i18n.footerContactOwnerLabel)}:</strong> ${escapeHtml(i18n.footerContactOwnerName)}</div>
            <div><strong>${escapeHtml(i18n.footerContactEmailLabel)}:</strong> <a href="mailto:idriss.zaghez@gmail.com">idriss.zaghez@gmail.com</a></div>
          </div>
        </div>
      </div>
      <div class="footer-meta">
        <p>© ${new Date().getFullYear()} ${escapeHtml(i18n.brandTitle)}. ${escapeHtml(i18n.footerRights)}</p>
        <p>${escapeHtml(i18n.footerTeamCreditsLine)}</p>
      </div>
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
    body { margin:0; color:var(--text); font-family:var(--font-sans); background:var(--bg-a),var(--bg-b),var(--bg-c),var(--bg-d, none); min-height:100vh; display:flex; flex-direction:column; }
    .wrap { width:min(1100px,94vw); margin:0 auto; }
    main { flex:1; }
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
    .settings-shell { display:grid; gap:14px; grid-template-columns:250px 1fr; align-items:start; }
    .settings-nav { position:sticky; top:14px; align-self:start; background:var(--card-2); border:1px solid rgba(230,207,139,.16); border-radius:18px; padding:12px; }
    .settings-nav-title { font:800 1.05rem var(--font-serif); color:var(--gold-2); margin:0 0 10px; }
    .settings-nav a { display:block; padding:9px 10px; border-radius:14px; text-decoration:none; color:var(--text); font-weight:800; border:1px solid transparent; }
    [dir="rtl"] .settings-nav a { text-align:right; }
    .settings-nav a:hover { background:var(--field-2); border-color:var(--border); }
    .settings-nav a.active { background:var(--field); border-color:rgba(230,207,139,.55); box-shadow:0 0 0 1px rgba(230,207,139,.2) inset; }
    .settings-nav a.muted { color:var(--muted); font-weight:700; }
    .settings-main { min-width:0; }
    .settings-anchor { scroll-margin-top:90px; }
    .sticky-actions { position:sticky; bottom:14px; background:var(--card); border:1px solid var(--border); border-radius:18px; padding:12px; box-shadow:var(--shadow); display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
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
    .range-row { display:flex; gap:10px; align-items:center; }
    [dir="rtl"] .range-row { flex-direction:row-reverse; }
    .range { width:100%; accent-color:var(--gold-2); }
    .range-out { font-weight:800; color:var(--gold-2); min-width:64px; text-align:right; }
    [dir="rtl"] .range-out { text-align:left; }
    .check-row { display:flex; gap:10px; border:1px solid var(--border); border-radius:12px; padding:10px; background:var(--field-2); }
    .check-row small { color:var(--muted); }
    .prayer-grid { display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); }
    .prayer-pill { display:flex; align-items:center; gap:8px; border:1px solid var(--border); border-radius:12px; padding:9px 10px; background:var(--field-2); }
    .prayer-pill span { font-weight:700; color:var(--text); }
    .form-actions { margin-top:14px; display:flex; flex-wrap:wrap; gap:10px; }
    .flash { width:min(1100px,94vw); margin:0 auto 12px; border-radius:12px; padding:10px 14px; font-weight:800; }
    .flash.success { background:rgba(94,196,168,.22); color:var(--text); border:1px solid rgba(94,196,168,.5); }
    .flash.error { background:rgba(255,159,137,.2); color:var(--text); border:1px solid rgba(255,159,137,.55); }
    .footer { margin:22px auto 26px; margin-top:auto; text-align:center; color:var(--muted-2); font-size:.9rem; }
    .footer p { margin:8px 0 0; color:var(--muted); }
    .footer-grid { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap; }
    .footer-links { display:inline-flex; gap:10px; align-items:center; }
    .footer-links a { color:var(--gold-2); text-decoration:none; }
    .footer-links a:hover { text-decoration:underline; }
    .footer-card { text-align:left; background:var(--card-2); border:1px solid rgba(230,207,139,.16); border-radius:16px; padding:12px 14px; min-width:min(420px, 100%); }
    [dir="rtl"] .footer-card { text-align:right; }
    .footer-card-title { font:800 1rem var(--font-serif); color:var(--gold-2); margin:0 0 8px; }
    .footer-card-body { display:grid; gap:6px; color:var(--muted); }
    .footer-card-body a { color:var(--gold-2); text-decoration:none; }
    .footer-card-body a:hover { text-decoration:underline; }
    .footer-meta { margin-top:10px; }

    .switch { position:relative; display:inline-flex; align-items:center; gap:10px; padding:6px 12px; border-radius:999px; border:1px solid var(--border); background:var(--field-2); cursor:pointer; user-select:none; }
    .switch input { position:absolute; opacity:0; width:1px; height:1px; }
    .slider { width:44px; height:24px; border-radius:999px; background:rgba(230,207,139,.18); border:1px solid var(--border-2); position:relative; flex:0 0 auto; }
    html[data-theme="light"] .slider { background:rgba(183,139,47,.14); }
    .slider::after { content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:999px; background:linear-gradient(180deg,var(--gold-2),var(--gold)); box-shadow:0 6px 16px rgba(0,0,0,.18); transition:transform .18s ease; }
    .switch input:checked + .slider::after { transform:translateX(20px); }
    .switch-text { font:700 .86rem var(--font-sans); color:var(--muted-2); }
    html[data-theme="light"] .switch-text { color:var(--muted-2); }
    html[data-theme="dark"] .switch-text { color:var(--muted-2); }
    @media (max-width:900px) {
      .settings-shell { grid-template-columns:1fr; }
      [dir="rtl"] .settings-shell { grid-template-columns:1fr; }
      .settings-nav { position:static; display:flex; gap:8px; overflow:auto; padding:10px; }
      .settings-nav-title { display:none; }
      .settings-nav a { white-space:nowrap; }
    }
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
      <a class="btn btn-soft" href="${escapeHtml(addAsAppUrlValue || "#")}">${escapeHtml(i18n.addAsApp)}</a>
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

function buildHomeContent({ oauthEnabled, dashboardLanguage, user }) {
  const i18n = getDashboardI18n(dashboardLanguage);
  const ctaHref = user ? "/dashboard" : "/auth/discord";
  return `
    <section class="card hero">
      <h1>${escapeHtml(i18n.homeTitle)}</h1>
      <p>
        ${escapeHtml(i18n.homeDescription)}
      </p>
      <div class="cta-row">
        <a class="btn btn-primary" href="${escapeHtml(ctaHref)}">${escapeHtml(
          oauthEnabled ? i18n.homePrimaryCtaOpen : i18n.homePrimaryCtaSetup
        )}</a>
      </div>
      <div class="features">
        <article class="feature"><h3>${escapeHtml(i18n.featurePrayerTitle)}</h3><p>${escapeHtml(
          i18n.featurePrayerDesc
        )}</p></article>
        <article class="feature"><h3>${escapeHtml(i18n.featureRemindersTitle)}</h3><p>${escapeHtml(
          i18n.featureRemindersDesc
        )}</p></article>
        <article class="feature"><h3>${escapeHtml(i18n.featureVoiceTitle)}</h3><p>${escapeHtml(
          i18n.featureVoiceDesc
        )}</p></article>
        <article class="feature"><h3>${escapeHtml(i18n.featureDashboardTitle)}</h3><p>${escapeHtml(
          i18n.featureDashboardDesc
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

function renderDashboardPage({
  userConfig,
  manageableGuilds,
  inviteOnlyGuilds,
  csrfToken,
  dashboardLanguage,
  activeSection
}) {
  const i18n = getDashboardI18n(dashboardLanguage);
  const section = normalizeDashboardProfileSection(activeSection);
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
  const dmAzkarIntervalOptionTags = reminderIntervalOptions(
    userConfig.dmAzkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES,
    dashboardLanguage
  );
  const dmHadithIntervalOptionTags = reminderIntervalOptions(
    userConfig.dmHadithIntervalMinutes ?? 360,
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

  const sectionNavLink = ({ key, label, muted = false }) => {
    const classes = ["", muted ? "muted" : "", section === key ? "active" : ""].filter(Boolean).join(" ");
    return `<a class="${escapeHtml(classes)}" href="/dashboard?section=${escapeHtml(key)}">${escapeHtml(label)}</a>`;
  };

  const sectionNav = `
    <aside class="settings-nav" aria-label="${escapeHtml(i18n.sectionsTitle)}">
      <div class="settings-nav-title">${escapeHtml(i18n.sectionsTitle)}</div>
      ${sectionNavLink({ key: "servers", label: i18n.sectionServers })}
      ${sectionNavLink({ key: "dm-location", label: i18n.sectionLocation })}
      ${sectionNavLink({ key: "dm-language", label: i18n.sectionLanguage })}
      ${sectionNavLink({ key: "dm-reminders", label: i18n.sectionReminders })}
      ${sectionNavLink({ key: "dm-schedule", label: i18n.sectionSchedule })}
      ${sectionNavLink({ key: "dm-instant", label: i18n.sectionInstant, muted: true })}
      ${sectionNavLink({ key: "dm-data", label: i18n.sectionData, muted: true })}
    </aside>
  `;

  const serversPanel = `
    <div class="grid-2 settings-anchor">
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

  const dmLocationPanel = `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.sectionLocation)}</h2>
      <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
      <form method="post" action="/dashboard/profile">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="dm-location" />
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
        <div class="sticky-actions">
          <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveDmSettingsButton)}</button>
        </div>
      </form>
    </section>
  `;

  const dmLanguagePanel = `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.sectionLanguage)}</h2>
      <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
      <form method="post" action="/dashboard/profile">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="dm-language" />
        <div class="form-grid">
          <label class="field"><span>${escapeHtml(i18n.globalLanguageLabel)}</span><select name="language">${dmLanguageOptions}</select></label>
        </div>
        <div class="sticky-actions">
          <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveDmSettingsButton)}</button>
        </div>
      </form>
    </section>
  `;

  const dmRemindersPanel = `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.sectionReminders)}</h2>
      <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
      <form method="post" action="/dashboard/profile">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="dm-reminders" />
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
        <div class="sticky-actions">
          <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveDmSettingsButton)}</button>
        </div>
      </form>
    </section>
  `;

  const dmSchedulePanel = `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.sectionSchedule)}</h2>
      <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
      <form method="post" action="/dashboard/profile">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="dm-schedule" />
        <div class="form-grid">
          <label class="field"><span>${escapeHtml(i18n.prePrayerLeadLabel)}</span><select name="dmPrePrayerLeadMinutes">${dmPrePrayerLeadOptionTags}</select></label>
          <label class="field" style="grid-column:1/-1;"><span>${escapeHtml(i18n.prePrayerPrayersLabel)}</span>${dmPrePrayerSelectionHtml}</label>
          <label class="field"><span>${escapeHtml(i18n.azkarIntervalLabel)}</span><select name="dmAzkarIntervalMinutes">${dmAzkarIntervalOptionTags}</select></label>
          <label class="field"><span>${escapeHtml(i18n.hadithIntervalLabel)}</span><select name="dmHadithIntervalMinutes">${dmHadithIntervalOptionTags}</select></label>
          <label class="field"><span>${escapeHtml(i18n.hadithGradeLabel)}</span><select name="dmHadithMinGrade">${hadithGradeOptions}</select></label>
        </div>
        <div class="sticky-actions">
          <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveDmSettingsButton)}</button>
        </div>
      </form>
    </section>
  `;

  const dmInstantPanel = `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.sectionInstant)}</h2>
      <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
      <div class="form-actions" style="margin-top:12px;">
        <form method="post" action="/dashboard/profile/instant-azkar" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-soft" type="submit">${escapeHtml(i18n.sendNowAzkarDmButton)}</button>
        </form>
        <form method="post" action="/dashboard/profile/instant-hadith" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-ghost" type="submit">${escapeHtml(i18n.sendNowHadithDmButton)}</button>
        </form>
      </div>
    </section>
  `;

  const dmDataPanel = `
    <section class="card">
      <h2 class="section-title">${escapeHtml(i18n.sectionData)}</h2>
      <p class="subtle">${escapeHtml(i18n.dataRightsDesc)}</p>
      <div class="form-actions" style="margin-top:12px;">
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
  `;

  const activePanel =
    section === "servers"
      ? serversPanel
      : section === "dm-location"
        ? dmLocationPanel
        : section === "dm-language"
          ? dmLanguagePanel
        : section === "dm-reminders"
          ? dmRemindersPanel
          : section === "dm-schedule"
            ? dmSchedulePanel
            : section === "dm-instant"
              ? dmInstantPanel
              : dmDataPanel;

  const dmScopeBanner =
    section === "servers"
      ? ""
      : `
        <section class="card">
          <h2 class="section-title">${escapeHtml(i18n.personalDmSettingsTitle)}</h2>
          <p class="subtle">${escapeHtml(i18n.personalDmSettingsDesc)}</p>
        </section>
      `;

  return `
    <div class="settings-shell">
      ${sectionNav}
      <div class="settings-main">
        <div class="stack">${dmScopeBanner}${activePanel}</div>
      </div>
    </div>
  `;
}

function renderGuildSettingsPage({
  guild,
  guildConfig,
  textChannels,
  voiceChannels,
  roles,
  csrfToken,
  dashboardLanguage,
  activeSection,
  quranStatus,
  quranSurahs,
  quranEveryAyahReciters,
  quranQaris
}) {
  const i18n = getDashboardI18n(dashboardLanguage);
  const section = normalizeDashboardGuildSection(activeSection);
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
  const quranVoiceChannelOptions = [optionTag({ value: "", label: i18n.optionNotSet, selected: !guildConfig.quranRadioVoiceChannelId })]
    .concat(
      voiceChannels.map((channel) =>
        optionTag({
          value: channel.id,
          label: channel.name,
          selected: guildConfig.quranRadioVoiceChannelId === channel.id
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
  const guildAzkarIntervalOptionTags = reminderIntervalOptions(
    guildConfig.azkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES,
    dashboardLanguage
  );
  const guildHadithIntervalOptionTags = reminderIntervalOptions(
    guildConfig.hadithIntervalMinutes ?? 360,
    dashboardLanguage
  );

  const quranQariId = Number.isFinite(Number(guildConfig.quranRadioQariId)) ? Number(guildConfig.quranRadioQariId) : 5;
  const qariList = Array.isArray(quranQaris) && quranQaris.length ? quranQaris : null;
  const quranQariOptions = (qariList || QURAN_QARI_PRESETS)
    .map((qari) => {
      const id = Number(qari?.id);
      if (!Number.isFinite(id)) return "";
      const label = qari?.name ? String(qari.name) : String(qari?.label || `Reciter ${id}`);
      return optionTag({ value: id, label, selected: id === quranQariId });
    })
    .filter(Boolean)
    .concat(
      (qariList ? qariList.some((q) => Number(q?.id) === quranQariId) : QURAN_QARI_PRESETS.some((q) => q.id === quranQariId))
        ? []
        : [
            optionTag({
              value: quranQariId,
              label: `Custom (${quranQariId})`,
              selected: true
            })
          ]
    )
    .join("");

  const quranSurahList = Array.isArray(quranSurahs) && quranSurahs.length ? quranSurahs : [];
  const selectedSurahId = Number.isFinite(Number(guildConfig.quranDefaultSurahId))
    ? Number(guildConfig.quranDefaultSurahId)
    : 1;
  const quranSurahOptions = quranSurahList.length
    ? quranSurahList
        .map((surah) => {
          const id = Number(surah?.id);
          const simple = surah?.name?.simple || `Surah ${id}`;
          const english = surah?.name?.english ? ` — ${surah.name.english}` : "";
          const label = `${id}. ${simple}${english}`;
          return optionTag({ value: id, label, selected: id === selectedSurahId });
        })
        .join("")
    : Array.from({ length: 114 }, (_, i) => i + 1)
        .map((id) => optionTag({ value: id, label: `Surah ${id}`, selected: id === selectedSurahId }))
        .join("");

  const everyAyahList = Array.isArray(quranEveryAyahReciters) ? quranEveryAyahReciters : [];
  const currentEveryAyahKey = String(guildConfig.quranEveryAyahReciterKey || "Alafasy_128kbps").trim();
  const everyAyahKnown = new Set(everyAyahList.map((entry) => String(entry?.key || "")));
  const everyAyahOptions = everyAyahList
    .map((entry) => {
      const key = String(entry?.key || "").trim();
      const label = String(entry?.label || "").trim() || key;
      if (!key) return "";
      return optionTag({
        value: key,
        label: `${label} (${key})`,
        selected: key === currentEveryAyahKey
      });
    })
    .filter(Boolean)
    .concat(
      everyAyahKnown.has(currentEveryAyahKey)
        ? []
        : [
            optionTag({
              value: currentEveryAyahKey,
              label: `Custom (${currentEveryAyahKey})`,
              selected: true
            })
          ]
    )
    .join("");

  const quranMode = String(quranStatus?.mode || "").trim().toLowerCase();
  const quranStatusText =
    quranMode === "radio"
      ? i18n.quranStatusRadio
      : quranMode === "surah"
        ? i18n.quranStatusSurah
        : quranMode === "ayah"
          ? i18n.quranStatusAyah
          : i18n.quranStatusStopped;
  const quranVolumePercent = Math.round(Math.max(0, Math.min(1, Number(guildConfig.quranRadioVolume ?? 0.35))) * 100);

  const guildBasePath = `/dashboard/guild/${String(guild.id)}`;
  const sectionLink = ({ key, label, muted = false }) => {
    const classes = ["", muted ? "muted" : "", section === key ? "active" : ""].filter(Boolean).join(" ");
    return `<a class="${escapeHtml(classes)}" href="${escapeHtml(`${guildBasePath}?section=${key}`)}">${escapeHtml(label)}</a>`;
  };

  const sectionNav = `
    <aside class="settings-nav" aria-label="${escapeHtml(i18n.sectionsTitle)}">
      <div class="settings-nav-title">${escapeHtml(i18n.sectionsTitle)}</div>
      ${sectionLink({ key: "quran-radio", label: i18n.sectionQuranRadio })}
      ${sectionLink({ key: "quran-ayah", label: i18n.sectionQuranAyah })}
      ${sectionLink({ key: "language", label: i18n.sectionLanguage })}
      ${sectionLink({ key: "location", label: i18n.sectionLocation })}
      ${sectionLink({ key: "channels", label: i18n.sectionChannels })}
      ${sectionLink({ key: "preprayer", label: i18n.sectionPrePrayer })}
      ${sectionLink({ key: "azkar", label: i18n.sectionAzkar })}
      ${sectionLink({ key: "hadith", label: i18n.sectionHadith })}
      ${sectionLink({ key: "instant", label: i18n.sectionInstant, muted: true })}
      ${sectionLink({ key: "data", label: i18n.sectionData, muted: true })}
    </aside>
  `;

  const stickyActions = `
    <div class="sticky-actions">
      <button class="btn btn-primary" type="submit">${escapeHtml(i18n.saveServerSettingsButton)}</button>
      <a class="btn btn-soft" href="/dashboard">${escapeHtml(i18n.backToDashboardButton)}</a>
    </div>
  `;

  const locationForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.locationSectionTitle)}</h3>
      <form method="post" action="${escapeHtml(guildBasePath)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="location" />
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
        ${stickyActions}
      </form>
    </section>
  `;

  const channelsForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.adhanChannelsSectionTitle)}</h3>
      <form method="post" action="${escapeHtml(guildBasePath)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="channels" />
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
        ${stickyActions}
      </form>
    </section>
  `;

  const prePrayerForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.prePrayerSectionTitle)}</h3>
      <form method="post" action="${escapeHtml(guildBasePath)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="preprayer" />
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
        ${stickyActions}
      </form>
    </section>
  `;

  const azkarForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.azkarSectionTitle)}</h3>
      <form method="post" action="${escapeHtml(guildBasePath)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="azkar" />
        <div class="stack">
          ${checkboxRow({
            label: i18n.enableAzkarLabel,
            name: "azkarRemindersEnabled",
            checked: guildConfig.azkarRemindersEnabled
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <label class="field"><span>${escapeHtml(i18n.intervalMinutesLabel)}</span><select name="azkarIntervalMinutes">${guildAzkarIntervalOptionTags}</select></label>
        </div>
        ${stickyActions}
      </form>
    </section>
  `;

  const languageForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.sectionLanguage)}</h3>
      <form method="post" action="${escapeHtml(guildBasePath)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="language" />
        <div class="form-grid">
          <label class="field"><span>${escapeHtml(i18n.globalLanguageLabel)}</span><select name="language">${globalLanguageOptions}</select></label>
        </div>
        ${stickyActions}
      </form>
    </section>
  `;

  const hadithForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.hadithSectionTitle)}</h3>
      <form method="post" action="${escapeHtml(guildBasePath)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="hadith" />
        <div class="stack">
          ${checkboxRow({
            label: i18n.enableHadithLabel,
            name: "hadithRemindersEnabled",
            checked: guildConfig.hadithRemindersEnabled
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <label class="field"><span>${escapeHtml(i18n.hadithIntervalLabel)}</span><select name="hadithIntervalMinutes">${guildHadithIntervalOptionTags}</select></label>
          <label class="field"><span>${escapeHtml(i18n.minimumGradeLabel)}</span><select name="hadithMinGrade">${hadithGradeOptions}</select></label>
        </div>
        ${stickyActions}
      </form>
    </section>
  `;

  const quranStatusCard = `
    <div class="stack" style="margin-top:12px;">
      <div class="check-row">
        <div>
          <div style="font-weight:800;">${escapeHtml(i18n.quranStatusLabel)}: ${escapeHtml(quranStatusText)}</div>
          ${quranStatus?.lastError ? `<small>${escapeHtml(String(quranStatus.lastError))}</small>` : ""}
        </div>
      </div>
    </div>
  `;

  const quranRadioForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(
        i18n.quranRadioSectionTitle
      )}</h3>
      <p class="subtle">${escapeHtml(i18n.quranRadioSectionDesc)}</p>
      ${quranStatusCard}
      <div class="form-actions" style="margin-top:12px;">
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/quran/radio-start" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-soft" type="submit">${escapeHtml(i18n.startRadioButton)}</button>
        </form>
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/quran/radio-stop" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-ghost" type="submit">${escapeHtml(i18n.stopRadioButton)}</button>
        </form>
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/quran/play-surah" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-soft" type="submit">${escapeHtml(i18n.playSurahButton)}</button>
        </form>
      </div>
      <form method="post" action="${escapeHtml(guildBasePath)}" style="margin-top:12px;">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="quran-radio" />
        <div class="stack">
          ${checkboxRow({
            label: i18n.enableQuranRadioLabel,
            name: "quranRadioEnabled",
            checked: guildConfig.quranRadioEnabled
          })}
        </div>
        <div class="form-grid" style="margin-top:10px;">
          <label class="field"><span>${escapeHtml(i18n.quranVoiceChannelLabel)}</span><select name="quranRadioVoiceChannelId">${quranVoiceChannelOptions}</select></label>
          <label class="field"><span>${escapeHtml(i18n.quranReciterLabel)}</span><select name="quranRadioQariId">${quranQariOptions}</select></label>
          <label class="field" style="grid-column:1/-1;">
            <span>${escapeHtml(i18n.quranVolumeLabel)}</span>
            <div class="range-row">
              <input
                class="range"
                type="range"
                name="quranRadioVolume"
                min="0"
                max="100"
                step="1"
                value="${escapeHtml(quranVolumePercent)}"
                oninput="this.nextElementSibling.textContent=this.value+'%';"
              />
              <output class="range-out" dir="ltr">${escapeHtml(quranVolumePercent)}%</output>
            </div>
          </label>
          <label class="field" style="grid-column:1/-1;"><span>${escapeHtml(i18n.quranSurahLabel)}</span><select name="quranDefaultSurahId">${quranSurahOptions}</select></label>
        </div>
        ${stickyActions}
      </form>
    </section>
  `;

  const quranAyahForm = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(
        i18n.quranAyahSectionTitle
      )}</h3>
      <p class="subtle">${escapeHtml(i18n.quranAyahSectionDesc)}</p>
      ${quranStatusCard}
      <div class="form-actions" style="margin-top:12px;">
        <form method="post" action="/dashboard/guild/${escapeHtml(guild.id)}/quran/play-ayah" class="inline-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
          <button class="btn btn-soft" type="submit">${escapeHtml(i18n.playAyahButton)}</button>
        </form>
      </div>
      <form method="post" action="${escapeHtml(guildBasePath)}" style="margin-top:12px;">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        <input type="hidden" name="section" value="quran-ayah" />
        <div class="form-grid">
          <label class="field"><span>${escapeHtml(i18n.quranVoiceChannelLabel)}</span><select name="quranRadioVoiceChannelId">${quranVoiceChannelOptions}</select></label>
          ${
            everyAyahOptions
              ? `<label class="field"><span>${escapeHtml(i18n.quranEveryAyahReciterLabel)}</span><select name="quranEveryAyahReciterKey">${everyAyahOptions}</select></label>`
              : settingsInputRow({
                  label: i18n.quranEveryAyahReciterLabel,
                  name: "quranEveryAyahReciterKey",
                  value: guildConfig.quranEveryAyahReciterKey || "Alafasy_128kbps",
                  placeholder: "Alafasy_128kbps"
                })
          }
          <label class="field" style="grid-column:1/-1;">
            <span>${escapeHtml(i18n.quranVolumeLabel)}</span>
            <div class="range-row">
              <input
                class="range"
                type="range"
                name="quranRadioVolume"
                min="0"
                max="100"
                step="1"
                value="${escapeHtml(quranVolumePercent)}"
                oninput="this.nextElementSibling.textContent=this.value+'%';"
              />
              <output class="range-out" dir="ltr">${escapeHtml(quranVolumePercent)}%</output>
            </div>
          </label>
          <label class="field" style="grid-column:1/-1;"><span>${escapeHtml(i18n.quranSurahLabel)}</span><select name="quranDefaultSurahId">${quranSurahOptions}</select></label>
          ${settingsInputRow({
            label: i18n.quranAyahFromLabel,
            name: "quranDefaultAyahFrom",
            value: guildConfig.quranDefaultAyahFrom ?? 1,
            type: "number",
            min: 1,
            max: 999
          })}
          ${settingsInputRow({
            label: i18n.quranAyahToLabel,
            name: "quranDefaultAyahTo",
            value: guildConfig.quranDefaultAyahTo ?? 7,
            type: "number",
            min: 1,
            max: 999
          })}
        </div>
        ${stickyActions}
      </form>
    </section>
  `;

  const instantPanel = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.instantActionsTitle)}</h3>
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
    </section>
  `;

  const dataPanel = `
    <section class="card">
      <h3 class="section-title settings-anchor" style="font-size:1.15rem;margin-top:0;">${escapeHtml(i18n.dataRightsTitle)}</h3>
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
      <div class="form-actions">
        <a class="btn btn-soft" href="/dashboard">${escapeHtml(i18n.backToDashboardButton)}</a>
      </div>
    </section>
  `;

  const activePanel =
    section === "location"
      ? locationForm
      : section === "channels"
        ? channelsForm
        : section === "preprayer"
          ? prePrayerForm
          : section === "language"
            ? languageForm
          : section === "azkar"
            ? azkarForm
            : section === "hadith"
              ? hadithForm
              : section === "quran-radio"
                ? quranRadioForm
                : section === "quran-ayah"
                  ? quranAyahForm
                : section === "instant"
                  ? instantPanel
                  : dataPanel;

  return `
    <div class="stack">
      <section class="card">
        <h2 class="section-title">${escapeHtml(i18n.serverSettingsTitle)}: ${escapeHtml(guild.name)}</h2>
        <p class="subtle">${escapeHtml(i18n.serverSettingsDescription)}</p>
      </section>
      <div class="settings-shell">
        ${sectionNav}
        <div class="settings-main">
          <div class="stack">${activePanel}</div>
        </div>
      </div>
    </div>
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

async function startDashboardServer({ client, guildStore, userStore, quranVoice }) {
  const app = express();
  const webPort = Number(process.env.WEB_PORT || 3000);
  const webBaseUrl = String(process.env.WEB_BASE_URL || `http://localhost:${webPort}`).replace(/\/+$/, "");
  const sessionCookieDomain = String(process.env.SESSION_COOKIE_DOMAIN || "").trim();
  const baseUrlIsHttps = webBaseUrl.startsWith("https://");
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
        secure: baseUrlIsHttps,
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
    // Persist preference even if the session cookie doesn't stick (common behind subdomain swaps).
    setCookie(res, DASHBOARD_LANG_COOKIE, nextLanguage, { secure: baseUrlIsHttps, domain: sessionCookieDomain });
    const returnPath = safeReturnPath(req.body.return_to || req.get("referer") || "/");
    res.redirect(returnPath);
  });

  app.post("/dashboard/theme", (req, res) => {
    const nextTheme = normalizeDashboardTheme(req.body.theme);
    req.session.dashboardTheme = nextTheme;
    setCookie(res, DASHBOARD_THEME_COOKIE, nextTheme, { secure: baseUrlIsHttps, domain: sessionCookieDomain });
    const returnPath = safeReturnPath(req.body.return_to || req.get("referer") || "/");
    res.redirect(returnPath);
  });

  app.get("/", (req, res) => {
    const dashboardLanguage = getDashboardLanguage(req);
    const dashboardTheme = getDashboardTheme(req);
    const flash = consumeFlash(req);
    const content = buildHomeContent({ oauthEnabled, dashboardLanguage, user: req.session.discordUser || null });
    const html = renderLayout({
      title: "Adhan Reminder Dashboard",
      content,
      user: req.session.discordUser || null,
      inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
      addAsAppUrlValue: addAsAppUrl({ clientId }),
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
      addAsAppUrlValue: addAsAppUrl({ clientId }),
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
      addAsAppUrlValue: addAsAppUrl({ clientId }),
      flash: consumeFlash(req),
      dashboardLanguage,
      dashboardTheme,
      returnPath: req.originalUrl || "/terms"
    });
    res.status(200).send(html);
  });

  app.get("/auth/discord", (req, res) => {
    if (req.session.discordUser) {
      res.redirect("/dashboard");
      return;
    }
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
      const activeSection = normalizeDashboardProfileSection(req.query?.section);
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
        dashboardLanguage,
        activeSection
      });
      const html = renderLayout({
        title: "Dashboard",
        content,
        user: req.session.discordUser,
        inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
        addAsAppUrlValue: addAsAppUrl({ clientId }),
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

    const sectionRaw = req.body.section;
    const section = sectionRaw ? normalizeDashboardProfileSection(sectionRaw) : null;
    const redirectUrl = section ? `/dashboard?section=${section}` : "/dashboard";

    try {
      const userId = req.session.discordUser.id;
      const current = userStore.getUserConfig(userId);
      if (section === "dm-location") {
        const city = String(req.body.city || "").trim();
        const country = String(req.body.country || "").trim();
        const method = parseBoundedInt(req.body.method, Number(current.location?.method ?? 3), 0, 99);
        const school = parseBoundedInt(req.body.school, Number(current.location?.school ?? 0), 0, 1);
        const resolvedLocation = await resolveCityCountryLocation({ city, country, method, school });
        userStore.updateUserConfig(userId, (draft) => {
          draft.location = resolvedLocation;
          return draft;
        });
        setFlash(req, "success", "Location saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "dm-language") {
        const language = normalizeContentLanguage(req.body.language || current.language);
        userStore.updateUserConfig(userId, (draft) => {
          draft.language = language;
          draft.dmAzkarLanguage = language;
          draft.dmHadithLanguage = language;
          return draft;
        });
        setFlash(req, "success", "Language saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "dm-reminders") {
        const dmRemindersEnabled = boolFromCheckbox(req.body.dmRemindersEnabled);
        const dmPrePrayerRemindersEnabled = boolFromCheckbox(req.body.dmPrePrayerRemindersEnabled);
        const dmAzkarRemindersEnabled = boolFromCheckbox(req.body.dmAzkarRemindersEnabled);
        const dmHadithRemindersEnabled = boolFromCheckbox(req.body.dmHadithRemindersEnabled);
        const anyEnabled =
          dmRemindersEnabled || dmPrePrayerRemindersEnabled || dmAzkarRemindersEnabled || dmHadithRemindersEnabled;

        if (anyEnabled && !hasValidLocation(current)) {
          throw new Error("Set your location first (Location tab), then enable reminders.");
        }

        userStore.updateUserConfig(userId, (draft) => {
          draft.dmRemindersEnabled = dmRemindersEnabled;
          draft.dmPrePrayerRemindersEnabled = dmPrePrayerRemindersEnabled;
          draft.dmAzkarRemindersEnabled = dmAzkarRemindersEnabled;
          draft.dmHadithRemindersEnabled = dmHadithRemindersEnabled;

          if (dmAzkarRemindersEnabled && !current.dmAzkarRemindersEnabled) {
            draft.dmAzkarLastSentAt = null;
          }
          if (dmHadithRemindersEnabled && !current.dmHadithRemindersEnabled) {
            draft.dmHadithLastTriggeredDate = null;
            draft.dmHadithLastSentAt = null;
          }
          if (dmPrePrayerRemindersEnabled && !current.dmPrePrayerRemindersEnabled) {
            draft.dmPrePrayerLastTriggered = {};
          }
          if (dmRemindersEnabled && !current.dmRemindersEnabled) {
            draft.lastTriggered = {};
          }
          return draft;
        });

        setFlash(req, "success", "DM reminder toggles saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "dm-schedule") {
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
        const dmHadithMinGrade = normalizeHadithGrade(req.body.dmHadithMinGrade || current.dmHadithMinGrade);
        const dmHadithIntervalMinutes = parseOptionalIntervalMinutes(
          req.body.dmHadithIntervalMinutes,
          current.dmHadithIntervalMinutes ?? null
        );
        const intervalChanged = (current.dmHadithIntervalMinutes ?? null) !== (dmHadithIntervalMinutes ?? null);

        userStore.updateUserConfig(userId, (draft) => {
          draft.dmPrePrayerLeadMinutes = dmPrePrayerLeadMinutes;
          draft.dmPrePrayerSelections = dmPrePrayerSelections;
          draft.dmAzkarIntervalMinutes = dmAzkarIntervalMinutes;
          draft.dmHadithIntervalMinutes = dmHadithIntervalMinutes;
          draft.dmHadithMinGrade = dmHadithMinGrade;
          if (intervalChanged) {
            draft.dmHadithLastTriggeredDate = null;
            draft.dmHadithLastSentAt = null;
          }
          return draft;
        });

        setFlash(req, "success", "DM schedule settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      // Backwards-compat (older UI): save everything in one form.
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
      const dmHadithMinGrade = normalizeHadithGrade(req.body.dmHadithMinGrade || current.dmHadithMinGrade);
      const dmHadithIntervalMinutes = parseOptionalIntervalMinutes(
        req.body.dmHadithIntervalMinutes,
        current.dmHadithIntervalMinutes ?? null
      );

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
        draft.dmHadithIntervalMinutes = dmHadithIntervalMinutes;
        draft.dmHadithMinGrade = dmHadithMinGrade;
        draft.dmHadithLanguage = language;
        if (dmAzkarRemindersEnabled) {
          draft.dmAzkarLastSentAt = null;
        }
        if (dmHadithRemindersEnabled) {
          draft.dmHadithLastTriggeredDate = null;
          draft.dmHadithLastSentAt = null;
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
      res.redirect(redirectUrl);
    } catch (error) {
      setFlash(req, "error", `Could not save personal settings: ${error.message}`);
      res.redirect(redirectUrl);
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
      const activeSection = normalizeDashboardGuildSection(req.query?.section);
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
      const quranStatus = quranVoice?.getStatus ? quranVoice.getStatus(guildId) : null;
      const quranSurahs = await getSurahs().catch(() => []);
      const quranEveryAyahReciters = await getEveryAyahReciters().catch(() => []);
      const quranQaris = await getQaris().catch(() => []);
      const content = renderGuildSettingsPage({
        guild,
        guildConfig,
        textChannels,
        voiceChannels,
        roles: selectableRoles,
        csrfToken: ensureCsrfToken(req),
        dashboardLanguage,
        activeSection,
        quranStatus,
        quranSurahs,
        quranEveryAyahReciters,
        quranQaris
      });

      const html = renderLayout({
        title: `Guild Dashboard - ${guild.name}`,
        content,
        user: req.session.discordUser,
        inviteUrlValue: inviteUrl({ clientId, permissions: botPermissions }),
        addAsAppUrlValue: addAsAppUrl({ clientId }),
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
    const sectionRaw = req.body.section;
    const section = sectionRaw ? normalizeDashboardGuildSection(sectionRaw) : null;
    const redirectUrl = section ? `/dashboard/guild/${guildId}?section=${section}` : `/dashboard/guild/${guildId}`;
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

      if (section === "location") {
        const city = String(req.body.city || "").trim();
        const country = String(req.body.country || "").trim();
        const method = parseBoundedInt(req.body.method, Number(current.location?.method ?? 3), 0, 99);
        const school = parseBoundedInt(req.body.school, Number(current.location?.school ?? 0), 0, 1);
        const resolvedLocation = await resolveCityCountryLocation({ city, country, method, school });
        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.location = resolvedLocation;
          return draft;
        });
        setFlash(req, "success", "Location saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "channels") {
        const reminderChannelId = normalizeIdField(req.body.reminderChannelId);
        const adhanVoiceChannelId = normalizeIdField(req.body.adhanVoiceChannelId);
        const mentionRoleId = normalizeIdField(req.body.mentionRoleId);
        const playAdhanInVoice = boolFromCheckbox(req.body.playAdhanInVoice);

        if (playAdhanInVoice && !adhanVoiceChannelId) {
          throw new Error("Voice playback is enabled but no voice channel is selected.");
        }

        const remindersCurrentlyEnabled =
          Boolean(current.prePrayerRemindersEnabled) || Boolean(current.azkarRemindersEnabled) || Boolean(current.hadithRemindersEnabled);
        if (!reminderChannelId && remindersCurrentlyEnabled) {
          throw new Error("Disable pre-prayer/azkar/hadith reminders before clearing the reminder channel.");
        }

        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.reminderChannelId = reminderChannelId;
          draft.adhanVoiceChannelId = adhanVoiceChannelId;
          draft.playAdhanInVoice = Boolean(playAdhanInVoice && adhanVoiceChannelId);
          draft.mentionRoleId = mentionRoleId;
          return draft;
        });

        setFlash(req, "success", "Channel settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "preprayer") {
        const prePrayerRemindersEnabled = boolFromCheckbox(req.body.prePrayerRemindersEnabled);
        const prePrayerLeadMinutes = normalizePrePrayerLeadMinutes(
          req.body.prePrayerLeadMinutes,
          Number(current.prePrayerLeadMinutes ?? DEFAULT_PRE_PRAYER_LEAD_MINUTES)
        );
        const prePrayerSelections = ensureAtLeastOnePrayerSelected(
          parsePrePrayerSelectionsFromBody(req.body, "prePrayer_")
        );

        if (prePrayerRemindersEnabled && !current.reminderChannelId) {
          throw new Error("Choose a reminder channel first (Channels tab), then enable pre-prayer reminders.");
        }

        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.prePrayerRemindersEnabled = prePrayerRemindersEnabled;
          draft.prePrayerLeadMinutes = prePrayerLeadMinutes;
          draft.prePrayerSelections = prePrayerSelections;
          if (prePrayerRemindersEnabled && !current.prePrayerRemindersEnabled) {
            draft.prePrayerLastTriggered = {};
          }
          return draft;
        });

        setFlash(req, "success", "Pre-prayer settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "azkar") {
        const azkarRemindersEnabled = boolFromCheckbox(req.body.azkarRemindersEnabled);
        const azkarIntervalMinutes = parseBoundedInt(
          req.body.azkarIntervalMinutes,
          Number(current.azkarIntervalMinutes ?? DEFAULT_AZKAR_INTERVAL_MINUTES),
          30,
          1440
        );

        if (azkarRemindersEnabled && !current.reminderChannelId) {
          throw new Error("Choose a reminder channel first (Channels tab), then enable azkar.");
        }

        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.azkarRemindersEnabled = azkarRemindersEnabled;
          draft.azkarIntervalMinutes = azkarIntervalMinutes;
          if (azkarRemindersEnabled && !current.azkarRemindersEnabled) {
            draft.azkarLastSentAt = null;
          }
          return draft;
        });

        setFlash(req, "success", "Azkar settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "language") {
        const language = normalizeContentLanguage(req.body.language || current.language);
        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.language = language;
          draft.azkarLanguage = language;
          draft.hadithLanguage = language;
          return draft;
        });
        setFlash(req, "success", "Language settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "hadith") {
        const hadithRemindersEnabled = boolFromCheckbox(req.body.hadithRemindersEnabled);
        const hadithIntervalMinutes = parseOptionalIntervalMinutes(
          req.body.hadithIntervalMinutes,
          current.hadithIntervalMinutes ?? null
        );
        const intervalChanged = (current.hadithIntervalMinutes ?? null) !== (hadithIntervalMinutes ?? null);
        const hadithMinGrade = normalizeHadithGrade(req.body.hadithMinGrade || current.hadithMinGrade);

        if (hadithRemindersEnabled && !current.reminderChannelId) {
          throw new Error("Choose a reminder channel first (Channels tab), then enable hadith.");
        }
        if (hadithRemindersEnabled && !hadithIntervalMinutes) {
          throw new Error("Choose a hadith interval before enabling hadith reminders.");
        }

        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.hadithRemindersEnabled = hadithRemindersEnabled;
          draft.hadithIntervalMinutes = hadithIntervalMinutes;
          draft.hadithMinGrade = hadithMinGrade;
          if (hadithRemindersEnabled && !current.hadithRemindersEnabled) {
            draft.hadithLastTriggeredDate = null;
            draft.hadithLastSentAt = null;
          }
          if (intervalChanged) {
            draft.hadithLastTriggeredDate = null;
            draft.hadithLastSentAt = null;
          }
          return draft;
        });

        setFlash(req, "success", "Hadith settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "quran-radio") {
        const quranRadioEnabled = boolFromCheckbox(req.body.quranRadioEnabled);
        const quranRadioVoiceChannelId = normalizeIdField(req.body.quranRadioVoiceChannelId);
        const quranRadioQariId = parseBoundedInt(
          req.body.quranRadioQariId,
          Number(current.quranRadioQariId ?? 5),
          1,
          10_000
        );
        const quranRadioVolume = normalizeVolume01FromPercent(req.body.quranRadioVolume, current.quranRadioVolume ?? 0.35);
        const quranDefaultSurahId = parseBoundedInt(req.body.quranDefaultSurahId, Number(current.quranDefaultSurahId ?? 1), 1, 114);

        if (quranRadioEnabled && !quranRadioVoiceChannelId) {
          throw new Error("Choose a Quran voice channel before enabling Quran 24/7.");
        }

        guildStore.updateGuildConfig(guildId, (draft) => {
          draft.quranRadioEnabled = quranRadioEnabled;
          draft.quranRadioVoiceChannelId = quranRadioVoiceChannelId;
          draft.quranRadioQariId = quranRadioQariId;
          draft.quranRadioVolume = quranRadioVolume;
          draft.quranDefaultSurahId = quranDefaultSurahId;
          return draft;
        });

        // Best-effort: apply radio state immediately.
        if (quranVoice?.startRadio && quranVoice?.stopGuild) {
          const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
          if (guild) {
            if (quranRadioEnabled && quranRadioVoiceChannelId) {
              quranVoice
                .startRadio({
                  guild,
                  voiceChannelId: quranRadioVoiceChannelId,
                  qariId: quranRadioQariId,
                  volume: quranRadioVolume,
                  startSurahId: quranDefaultSurahId
                })
                .catch((error) => console.error(`Failed to start Quran radio from dashboard in guild ${guildId}:`, error.message));
            } else {
              quranVoice.stopGuild(guildId, { leave: true }).catch(() => null);
            }
          }
        }

        setFlash(req, "success", "Quran 24/7 settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      if (section === "quran-ayah") {
        const quranRadioVoiceChannelId = normalizeIdField(req.body.quranRadioVoiceChannelId);
        const quranRadioVolume = normalizeVolume01FromPercent(req.body.quranRadioVolume, current.quranRadioVolume ?? 0.35);
        const quranEveryAyahReciterKey = String(req.body.quranEveryAyahReciterKey || current.quranEveryAyahReciterKey || "")
          .trim()
          .slice(0, 80);
        const quranDefaultSurahId = parseBoundedInt(req.body.quranDefaultSurahId, Number(current.quranDefaultSurahId ?? 1), 1, 114);
        const quranDefaultAyahFrom = parseBoundedInt(req.body.quranDefaultAyahFrom, Number(current.quranDefaultAyahFrom ?? 1), 1, 999);
        const quranDefaultAyahTo = parseBoundedInt(req.body.quranDefaultAyahTo, Number(current.quranDefaultAyahTo ?? 1), 1, 999);

        guildStore.updateGuildConfig(guildId, (draft) => {
          // Reuse the same voice channel + volume settings for all Quran playback.
          draft.quranRadioVoiceChannelId = quranRadioVoiceChannelId;
          draft.quranRadioVolume = quranRadioVolume;
          draft.quranEveryAyahReciterKey = quranEveryAyahReciterKey || draft.quranEveryAyahReciterKey;
          draft.quranDefaultSurahId = quranDefaultSurahId;
          draft.quranDefaultAyahFrom = quranDefaultAyahFrom;
          draft.quranDefaultAyahTo = quranDefaultAyahTo;
          return draft;
        });

        setFlash(req, "success", "Ayah playback settings saved.");
        res.redirect(redirectUrl);
        return;
      }

      // Backwards-compat (older UI): save everything in one form.
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
      const hadithIntervalMinutes = parseOptionalIntervalMinutes(
        req.body.hadithIntervalMinutes,
        current.hadithIntervalMinutes ?? null
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
        draft.hadithIntervalMinutes = hadithIntervalMinutes;
        draft.hadithMinGrade = hadithMinGrade;
        draft.hadithLanguage = language;
        if (azkarRemindersEnabled) {
          draft.azkarLastSentAt = null;
        }
        if (hadithRemindersEnabled) {
          draft.hadithLastTriggeredDate = null;
          draft.hadithLastSentAt = null;
        }
        if (prePrayerRemindersEnabled) {
          draft.prePrayerLastTriggered = {};
        }
        return draft;
      });

      setFlash(req, "success", "Server settings saved.");
      res.redirect(redirectUrl);
    } catch (error) {
      setFlash(req, "error", `Could not save server settings: ${error.message}`);
      res.redirect(redirectUrl);
    }
  });

  app.post("/dashboard/guild/:guildId/quran/radio-start", requireAuth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${guildId}?section=quran-radio`);
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
      const voiceChannelId = config.quranRadioVoiceChannelId || config.adhanVoiceChannelId;
      if (!voiceChannelId) {
        throw new Error("Choose a Quran voice channel first.");
      }
      if (!quranVoice?.startRadio) {
        throw new Error("Quran voice module is not enabled on this server.");
      }

      const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId));
      await quranVoice.startRadio({
        guild,
        voiceChannelId,
        qariId: config.quranRadioQariId ?? 5,
        volume: config.quranRadioVolume ?? 0.35,
        startSurahId: config.quranDefaultSurahId ?? 1
      });
      setFlash(req, "success", "Quran radio started.");
    } catch (error) {
      setFlash(req, "error", `Could not start Quran radio: ${error.message}`);
    }

    res.redirect(`/dashboard/guild/${guildId}?section=quran-radio`);
  });

  app.post("/dashboard/guild/:guildId/quran/radio-stop", requireAuth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${guildId}?section=quran-radio`);
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

      if (!quranVoice?.stopGuild) {
        throw new Error("Quran voice module is not enabled on this server.");
      }
      await quranVoice.stopGuild(guildId, { leave: true });
      setFlash(req, "success", "Quran radio stopped.");
    } catch (error) {
      setFlash(req, "error", `Could not stop Quran radio: ${error.message}`);
    }

    res.redirect(`/dashboard/guild/${guildId}?section=quran-radio`);
  });

  app.post("/dashboard/guild/:guildId/quran/play-surah", requireAuth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${guildId}?section=quran-radio`);
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
      const voiceChannelId = config.quranRadioVoiceChannelId || config.adhanVoiceChannelId;
      if (!voiceChannelId) {
        throw new Error("Choose a Quran voice channel first.");
      }
      if (!quranVoice?.playSurahOnce) {
        throw new Error("Quran voice module is not enabled on this server.");
      }

      const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId));
      await quranVoice.playSurahOnce({
        guild,
        voiceChannelId,
        qariId: config.quranRadioQariId ?? 5,
        surahId: config.quranDefaultSurahId ?? 1,
        volume: config.quranRadioVolume ?? 0.35
      });
      setFlash(req, "success", "Surah playback started.");
    } catch (error) {
      setFlash(req, "error", `Could not play surah: ${error.message}`);
    }

    res.redirect(`/dashboard/guild/${guildId}?section=quran-radio`);
  });

  app.post("/dashboard/guild/:guildId/quran/play-ayah", requireAuth, async (req, res) => {
    const guildId = req.params.guildId;
    if (!verifyCsrf(req)) {
      setFlash(req, "error", "Invalid form session. Refresh and try again.");
      res.redirect(`/dashboard/guild/${guildId}?section=quran-ayah`);
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
      const voiceChannelId = config.quranRadioVoiceChannelId || config.adhanVoiceChannelId;
      if (!voiceChannelId) {
        throw new Error("Choose a Quran voice channel first.");
      }
      if (!quranVoice?.playAyahRangeOnce) {
        throw new Error("Quran voice module is not enabled on this server.");
      }

      const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId));
      await quranVoice.playAyahRangeOnce({
        guild,
        voiceChannelId,
        everyAyahReciterKey: config.quranEveryAyahReciterKey || "Alafasy_128kbps",
        surahId: config.quranDefaultSurahId ?? 1,
        fromAyah: config.quranDefaultAyahFrom ?? 1,
        toAyah: config.quranDefaultAyahTo ?? 7,
        volume: config.quranRadioVolume ?? 0.35
      });
      setFlash(req, "success", "Ayah playback started.");
    } catch (error) {
      setFlash(req, "error", `Could not play ayahs: ${error.message}`);
    }

    res.redirect(`/dashboard/guild/${guildId}?section=quran-ayah`);
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
