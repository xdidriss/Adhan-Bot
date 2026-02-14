const { ChannelType, PermissionsBitField, SlashCommandBuilder } = require("discord.js");
const { CONTENT_LANGUAGE_CHOICES, HADITH_MIN_GRADE_CHOICES } = require("./islamicContentService");

const METHOD_CHOICES = [
  { name: "Muslim World League (3)", value: 3 },
  { name: "Umm Al-Qura, Makkah (4)", value: 4 },
  { name: "Egyptian General Authority (5)", value: 5 },
  { name: "ISNA (2)", value: 2 },
  { name: "University of Karachi (1)", value: 1 },
  { name: "Kuwait (9)", value: 9 },
  { name: "Qatar (10)", value: 10 },
  { name: "Singapore (11)", value: 11 },
  { name: "Turkey (13)", value: 13 },
  { name: "Moonsighting Committee (15)", value: 15 }
];

const SCHOOL_CHOICES = [
  { name: "Shafi/Maliki/Hanbali (0)", value: 0 },
  { name: "Hanafi (1)", value: 1 }
];

const PRAYER_CHOICES = [
  { name: "Fajr", value: "fajr" },
  { name: "Dhuhr", value: "dhuhr" },
  { name: "Asr", value: "asr" },
  { name: "Maghrib", value: "maghrib" },
  { name: "Isha", value: "isha" }
];

function addPrayerOptions(option) {
  option
    .setName("prayer")
    .setDescription("Prayer label for the test message")
    .setRequired(false);
  for (const choice of PRAYER_CHOICES) {
    option.addChoices(choice);
  }
  return option;
}

function addMethodOption(option) {
  option
    .setName("method")
    .setDescription("Prayer calculation method")
    .setRequired(false);
  for (const choice of METHOD_CHOICES) {
    option.addChoices(choice);
  }
  return option;
}

function addSchoolOption(option) {
  option
    .setName("school")
    .setDescription("Asr juristic method")
    .setRequired(false);
  for (const choice of SCHOOL_CHOICES) {
    option.addChoices(choice);
  }
  return option;
}

function addHadithGradeOption(option) {
  option
    .setName("min_grade")
    .setDescription("Minimum authenticity grade")
    .setRequired(false);
  for (const choice of HADITH_MIN_GRADE_CHOICES) {
    option.addChoices(choice);
  }
  return option;
}

function addContentLanguageOption(option) {
  option
    .setName("language")
    .setDescription("Message language for reminders")
    .setRequired(false);
  for (const choice of CONTENT_LANGUAGE_CHOICES) {
    option.addChoices(choice);
  }
  return option;
}

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("set-location")
      .setDescription("Set city and country for prayer time calculations.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addStringOption((option) =>
        option
          .setName("city")
          .setDescription("City name (e.g. New York)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("country")
          .setDescription("Country selector (start typing to search)")
          .setAutocomplete(true)
          .setRequired(true)
      )
      .addIntegerOption(addMethodOption)
      .addIntegerOption(addSchoolOption),
    new SlashCommandBuilder()
      .setName("set-channels")
      .setDescription("Set reminder text channel and optional voice channel for adhan.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addChannelOption((option) =>
        option
          .setName("reminder_channel")
          .setDescription("Text channel for prayer reminders")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName("voice_channel")
          .setDescription("Voice channel to join for adhan playback")
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("play_voice")
          .setDescription("Enable adhan playback in voice channel")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("set-mention-role")
      .setDescription("Set or clear role mention in reminder messages.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("Role to mention. Leave empty to clear.")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("set-azkar-reminders")
      .setDescription("Enable or disable periodic random azkar reminders in the server.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to enable periodic azkar reminders.")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("interval_minutes")
          .setDescription("Reminder interval in minutes (30-1440).")
          .setMinValue(30)
          .setMaxValue(1440)
          .setRequired(false)
      )
      .addStringOption(addContentLanguageOption),
    new SlashCommandBuilder()
      .setName("set-hadith-reminders")
      .setDescription("Enable or disable daily random hadith reminders in the server.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to enable daily hadith reminders.")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("hour")
          .setDescription("Hour in 24h format (0-23).")
          .setMinValue(0)
          .setMaxValue(23)
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("minute")
          .setDescription("Minute (0-59).")
          .setMinValue(0)
          .setMaxValue(59)
          .setRequired(false)
      )
      .addStringOption(addHadithGradeOption)
      .addStringOption(addContentLanguageOption),
    new SlashCommandBuilder()
      .setName("config")
      .setDescription("Show current adhan bot configuration for this server.")
      .setDMPermission(false),
    new SlashCommandBuilder()
      .setName("prayer-times")
      .setDescription("Show prayer times for today or a specific date.")
      .setDMPermission(false)
      .addStringOption((option) =>
        option
          .setName("date")
          .setDescription("Date in YYYY-MM-DD format (optional)")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("next-prayer")
      .setDescription("Show the next upcoming prayer time.")
      .setDMPermission(false),
    new SlashCommandBuilder()
      .setName("test-adhan")
      .setDescription("Send a test reminder now and optionally play adhan in voice.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addStringOption(addPrayerOptions),
    new SlashCommandBuilder()
      .setName("test-azkar")
      .setDescription("Send a random azkar reminder to the server reminder channel now.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false),
    new SlashCommandBuilder()
      .setName("test-hadith")
      .setDescription("Send a random hadith reminder to the server reminder channel now.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false),
    new SlashCommandBuilder()
      .setName("my-location")
      .setDescription("Set your personal city and country for DM prayer reminders.")
      .setDMPermission(true)
      .addStringOption((option) =>
        option
          .setName("city")
          .setDescription("City name (e.g. New York)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("country")
          .setDescription("Country selector (start typing to search)")
          .setAutocomplete(true)
          .setRequired(true)
      )
      .addIntegerOption(addMethodOption)
      .addIntegerOption(addSchoolOption),
    new SlashCommandBuilder()
      .setName("dm-reminders")
      .setDescription("Enable or disable your personal DM prayer reminders.")
      .setDMPermission(true)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to receive DM reminders, false to stop them.")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("dm-azkar-reminders")
      .setDescription("Enable or disable periodic random azkar reminders in DM.")
      .setDMPermission(true)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to enable DM azkar reminders.")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("interval_minutes")
          .setDescription("Reminder interval in minutes (30-1440).")
          .setMinValue(30)
          .setMaxValue(1440)
          .setRequired(false)
      )
      .addStringOption(addContentLanguageOption),
    new SlashCommandBuilder()
      .setName("dm-hadith-reminders")
      .setDescription("Enable or disable daily random hadith reminders in DM.")
      .setDMPermission(true)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to enable DM hadith reminders.")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("hour")
          .setDescription("Hour in 24h format (0-23).")
          .setMinValue(0)
          .setMaxValue(23)
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("minute")
          .setDescription("Minute (0-59).")
          .setMinValue(0)
          .setMaxValue(59)
          .setRequired(false)
      )
      .addStringOption(addHadithGradeOption)
      .addStringOption(addContentLanguageOption),
    new SlashCommandBuilder()
      .setName("dm-config")
      .setDescription("Show your personal DM reminder configuration.")
      .setDMPermission(true),
    new SlashCommandBuilder()
      .setName("dm-test")
      .setDescription("Send yourself a test DM prayer reminder now.")
      .setDMPermission(true)
      .addStringOption(addPrayerOptions),
    new SlashCommandBuilder()
      .setName("dm-test-azkar")
      .setDescription("Send yourself a random azkar reminder now.")
      .setDMPermission(true),
    new SlashCommandBuilder()
      .setName("dm-test-hadith")
      .setDescription("Send yourself a random hadith reminder now.")
      .setDMPermission(true),
    new SlashCommandBuilder()
      .setName("dm-prayer-times")
      .setDescription("Show prayer times for your personal location.")
      .setDMPermission(true)
      .addStringOption((option) =>
        option
          .setName("date")
          .setDescription("Date in YYYY-MM-DD format (optional)")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("dm-next-prayer")
      .setDescription("Show your next prayer time using your personal location.")
      .setDMPermission(true)
  ].map((command) => command.toJSON());
}

module.exports = {
  buildCommands,
  METHOD_CHOICES,
  PRAYER_CHOICES,
  SCHOOL_CHOICES
};
