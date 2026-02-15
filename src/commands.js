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
      .setName("quran-radio")
      .setDescription("Start/stop a 24/7 Quran recitation in a voice channel.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addSubcommand((sub) =>
        sub
          .setName("start")
          .setDescription("Start 24/7 Quran recitation (surah order).")
          .addChannelOption((option) =>
            option
              .setName("voice_channel")
              .setDescription("Voice channel to join (optional)")
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(false)
          )
          .addIntegerOption((option) =>
            option
              .setName("reciter_id")
              .setDescription("QuranicAudio reciter ID (optional)")
              .setRequired(false)
          )
          .addNumberOption((option) =>
            option
              .setName("volume")
              .setDescription("Volume 0.0 - 1.0 (optional)")
              .setMinValue(0)
              .setMaxValue(1)
              .setRequired(false)
          )
      )
      .addSubcommand((sub) => sub.setName("stop").setDescription("Stop Quran radio and leave voice."))
      .addSubcommand((sub) => sub.setName("status").setDescription("Show Quran radio status.")),
    new SlashCommandBuilder()
      .setName("quran-play")
      .setDescription("Play a specific surah or ayah range in voice.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addSubcommand((sub) =>
        sub
          .setName("surah")
          .setDescription("Play a surah now.")
          .addIntegerOption((option) =>
            option
              .setName("surah")
              .setDescription("Surah number (1-114)")
              .setMinValue(1)
              .setMaxValue(114)
              .setRequired(true)
          )
          .addChannelOption((option) =>
            option
              .setName("voice_channel")
              .setDescription("Voice channel to join (optional)")
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(false)
          )
          .addIntegerOption((option) =>
            option
              .setName("reciter_id")
              .setDescription("QuranicAudio reciter ID (optional)")
              .setRequired(false)
          )
          .addNumberOption((option) =>
            option
              .setName("volume")
              .setDescription("Volume 0.0 - 1.0 (optional)")
              .setMinValue(0)
              .setMaxValue(1)
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("ayah")
          .setDescription("Play an ayah range now (EveryAyah dataset).")
          .addIntegerOption((option) =>
            option
              .setName("surah")
              .setDescription("Surah number (1-114)")
              .setMinValue(1)
              .setMaxValue(114)
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("from")
              .setDescription("Starting ayah number")
              .setMinValue(1)
              .setMaxValue(999)
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("to")
              .setDescription("Ending ayah number (optional)")
              .setMinValue(1)
              .setMaxValue(999)
              .setRequired(false)
          )
          .addStringOption((option) =>
            option
              .setName("reciter_key")
              .setDescription("EveryAyah reciter key (optional, e.g. Alafasy_128kbps)")
              .setRequired(false)
          )
          .addChannelOption((option) =>
            option
              .setName("voice_channel")
              .setDescription("Voice channel to join (optional)")
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(false)
          )
          .addNumberOption((option) =>
            option
              .setName("volume")
              .setDescription("Volume 0.0 - 1.0 (optional)")
              .setMinValue(0)
              .setMaxValue(1)
              .setRequired(false)
          )
      ),
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
      .setDescription("Enable or disable periodic random hadith reminders in the server.")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to enable hadith reminders.")
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
      .setDescription("Enable or disable periodic random hadith reminders in DM.")
      .setDMPermission(true)
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Set true to enable DM hadith reminders.")
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
    ,
    new SlashCommandBuilder()
      .setName("export-my-data")
      .setDescription("Export your stored Adhan Reminder data (DM settings) as a JSON file.")
      .setDMPermission(true),
    new SlashCommandBuilder()
      .setName("delete-my-data")
      .setDescription("Delete your stored Adhan Reminder data (DM settings).")
      .setDMPermission(true),
    new SlashCommandBuilder()
      .setName("delete-guild-data")
      .setDescription("Delete this server's stored Adhan Reminder data (requires Manage Server).")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .setDMPermission(false)
  ].map((command) => command.toJSON());
}

module.exports = {
  buildCommands,
  METHOD_CHOICES,
  PRAYER_CHOICES,
  SCHOOL_CHOICES
};
