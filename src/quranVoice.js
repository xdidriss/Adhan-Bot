const { PermissionsBitField } = require("discord.js");
const { spawn } = require("node:child_process");
const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} = require("@discordjs/voice");

const { buildAyahMp3Url, buildSurahMp3Url, getQariById, getSurahs } = require("./quranSources");

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const ffmpegPath = require("ffmpeg-static");
    if (ffmpegPath) return ffmpegPath;
  } catch (_error) {
    // Optional dependency at runtime.
  }
  return "ffmpeg";
}

function spawnFfmpegPcmStream(inputUrl) {
  const ffmpegPath = resolveFfmpegPath();
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
    "-i",
    String(inputUrl),
    "-vn",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-f",
    "s16le",
    "pipe:1"
  ];

  const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  const stream = proc.stdout;
  let lastStderr = "";
  proc.stderr.on("data", (chunk) => {
    lastStderr = `${lastStderr}${chunk.toString("utf8")}`.slice(-1200);
  });

  const kill = () => {
    if (!proc.killed) {
      proc.kill("SIGKILL");
    }
  };

  return { proc, stream, kill, getLastStderr: () => lastStderr };
}

function canConnectAndSpeak({ channel, me }) {
  const permissions = channel.permissionsFor(me);
  if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
    return { ok: false, reason: "Bot is missing Connect permission in the voice channel." };
  }
  if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
    return { ok: false, reason: "Bot is missing Speak permission in the voice channel." };
  }
  return { ok: true };
}

function createQuranVoiceManager({ client, guildStore }) {
  const sessions = new Map();

  function getSession(guildId) {
    return sessions.get(guildId) || null;
  }

  function ensureSession(guildId) {
    const existing = sessions.get(guildId);
    if (existing) return existing;

    const player = createAudioPlayer();
    const session = {
      guildId,
      player,
      connection: null,
      subscription: null,
      ffmpeg: null,
      mode: null,
      queue: [],
      queueIndex: 0,
      radio: null,
      playbackToken: 0,
      lastError: null
    };

    player.on("error", (error) => {
      session.lastError = error;
      console.error(`Quran voice player error in guild ${guildId}:`, error.message);
      cleanupGuild(guildId, { leave: true });
    });

    player.on(AudioPlayerStatus.Idle, () => {
      // Next track is driven by playNext using playbackToken guards.
      // This handler exists mainly so we don't get stuck in idle states.
    });

    sessions.set(guildId, session);
    return session;
  }

  async function ensureConnection({ guild, voiceChannelId }) {
    const guildId = guild.id;
    const session = ensureSession(guildId);

    const channel = await guild.channels.fetch(voiceChannelId).catch(() => null);
    if (!channel || !channel.isVoiceBased()) {
      throw new Error("Configured Quran voice channel no longer exists.");
    }

    const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!me) {
      throw new Error("Bot member not available in this guild.");
    }
    const perms = canConnectAndSpeak({ channel, me });
    if (!perms.ok) throw new Error(perms.reason);

    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection && session.connection && existingConnection === session.connection) {
      // If the connection is for a different channel, destroy and re-join.
      if (existingConnection.joinConfig.channelId === channel.id) {
        return { session, channel };
      }
      existingConnection.destroy();
      session.connection = null;
      session.subscription = null;
    } else if (existingConnection && !session.connection) {
      // Another module created a connection; take over by destroying it.
      existingConnection.destroy();
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false
    });
    session.connection = connection;

    connection.on("error", (error) => {
      session.lastError = error;
      console.error(`Quran voice connection error in guild ${guildId}:`, error.message);
      cleanupGuild(guildId, { leave: true });
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    const subscription = connection.subscribe(session.player);
    if (!subscription) {
      connection.destroy();
      session.connection = null;
      throw new Error("Failed to subscribe Quran player to voice connection.");
    }
    session.subscription = subscription;

    return { session, channel };
  }

  function stopFfmpeg(session) {
    if (session.ffmpeg) {
      session.ffmpeg.kill();
      session.ffmpeg = null;
    }
  }

  function cleanupGuild(guildId, { leave } = { leave: true }) {
    const session = sessions.get(guildId);
    if (!session) return;
    stopFfmpeg(session);
    try {
      session.player.stop(true);
    } catch (_e) {
      // ignore
    }
    if (leave && session.connection) {
      try {
        session.connection.destroy();
      } catch (_e) {
        // ignore
      }
      session.connection = null;
      session.subscription = null;
    }
    session.mode = null;
    session.queue = [];
    session.queueIndex = 0;
    session.radio = null;
  }

  async function playUrl({ guild, voiceChannelId, url, volume = 0.35, onFinished }) {
    const { session } = await ensureConnection({ guild, voiceChannelId });
    session.playbackToken += 1;
    const token = session.playbackToken;

    stopFfmpeg(session);
    const ffmpeg = spawnFfmpegPcmStream(url);
    session.ffmpeg = ffmpeg;

    const resource = createAudioResource(ffmpeg.stream, { inputType: StreamType.Raw, inlineVolume: true });
    resource.volume?.setVolume(Math.max(0, Math.min(1, Number(volume) || 0.35)));
    session.player.play(resource);

    try {
      await entersState(session.player, AudioPlayerStatus.Playing, 10_000);
    } catch (error) {
      stopFfmpeg(session);
      const detail = ffmpeg.getLastStderr() || error.message || "Unknown playback startup error";
      throw new Error(`Unable to start Quran playback: ${detail}`);
    }

    const maybeFinished = () => {
      if (session.playbackToken !== token) return;
      if (typeof onFinished === "function") onFinished();
    };

    session.player.once(AudioPlayerStatus.Idle, () => {
      stopFfmpeg(session);
      maybeFinished();
    });

    ffmpeg.proc.once("exit", () => {
      // If ffmpeg dies early, player may stay playing; force a stop.
      if (session.playbackToken !== token) return;
      try {
        session.player.stop(true);
      } catch (_e) {
        // ignore
      }
    });
  }

  async function startRadio({ guild, voiceChannelId, qariId, volume = 0.35, startSurahId = 1 }) {
    const session = ensureSession(guild.id);
    session.mode = "radio";
    session.radio = { qariId: Number(qariId) || 5, volume: Number(volume) || 0.35 };
    session.queue = [];
    session.queueIndex = 0;

    const surahs = await getSurahs();
    if (!surahs.length) {
      throw new Error("Could not load surah list for Quran radio.");
    }
    const sortedSurahs = [...surahs].sort((a, b) => Number(a?.id) - Number(b?.id));
    const normalizedStartSurahId = Math.max(1, Math.min(114, Math.floor(Number(startSurahId) || 1)));
    const startIndex = Math.max(0, sortedSurahs.findIndex((s) => Number(s?.id) === normalizedStartSurahId));
    session.queueIndex = startIndex;

    const qari = await getQariById(session.radio.qariId);
    if (!qari?.relative_path) {
      throw new Error("Invalid reciter selection for Quran radio.");
    }

    const playNext = async () => {
      if (session.mode !== "radio") return;
      const idx = Number.isFinite(session.queueIndex) ? session.queueIndex : 0;
      const nextSurah = sortedSurahs[idx % sortedSurahs.length];
      session.queueIndex = (idx + 1) % sortedSurahs.length;
      const url = buildSurahMp3Url({ qariRelativePath: qari.relative_path, surahId: nextSurah?.id });
      if (!url) throw new Error("Could not build Quran radio stream URL.");
      await playUrl({
        guild,
        voiceChannelId,
        url,
        volume: session.radio.volume,
        onFinished: () => {
          setTimeout(() => {
            playNext().catch((error) => {
              session.lastError = error;
              console.error(`Quran radio next-track error in guild ${guild.id}:`, error.message);
              cleanupGuild(guild.id, { leave: true });
            });
          }, 400);
        }
      });
    };

    await playNext();
    return { ok: true };
  }

  async function playSurahOnce({ guild, voiceChannelId, qariId, surahId, volume = 0.35 }) {
    const qari = await getQariById(qariId);
    if (!qari?.relative_path) {
      throw new Error("Invalid reciter selection.");
    }
    const url = buildSurahMp3Url({ qariRelativePath: qari.relative_path, surahId });
    if (!url) {
      throw new Error("Invalid surah selection.");
    }
    const session = ensureSession(guild.id);
    session.mode = "surah";
    await playUrl({ guild, voiceChannelId, url, volume, onFinished: () => cleanupGuild(guild.id, { leave: false }) });
    return { ok: true };
  }

  async function playAyahRangeOnce({
    guild,
    voiceChannelId,
    everyAyahReciterKey,
    surahId,
    fromAyah,
    toAyah,
    volume = 0.35
  }) {
    const surah = Math.max(1, Math.min(114, Math.floor(Number(surahId))));
    const start = Math.max(1, Math.floor(Number(fromAyah)));
    const end = Math.max(start, Math.floor(Number(toAyah)));

    const session = ensureSession(guild.id);
    session.mode = "ayah";

    let current = start;
    const playNext = async () => {
      if (session.mode !== "ayah") return;
      if (current > end) {
        cleanupGuild(guild.id, { leave: false });
        return;
      }
      const url = buildAyahMp3Url({ everyAyahReciterKey, surahId: surah, ayahNumber: current });
      current += 1;
      if (!url) throw new Error("Could not build ayah audio URL.");
      await playUrl({
        guild,
        voiceChannelId,
        url,
        volume,
        onFinished: () => {
          setTimeout(() => {
            playNext().catch((error) => {
              session.lastError = error;
              console.error(`Quran ayah queue error in guild ${guild.id}:`, error.message);
              cleanupGuild(guild.id, { leave: true });
            });
          }, 250);
        }
      });
    };

    await playNext();
    return { ok: true };
  }

  async function stopGuild(guildId, { leave = true } = {}) {
    cleanupGuild(guildId, { leave });
    return { ok: true };
  }

  function getStatus(guildId) {
    const session = sessions.get(guildId);
    if (!session) return null;
    return {
      mode: session.mode,
      hasConnection: Boolean(session.connection),
      lastError: session.lastError ? String(session.lastError.message || session.lastError) : null
    };
  }

  async function ensureConfiguredRadios() {
    const all = guildStore.getAllConfigs();
    const entries = Object.entries(all);
    for (const [guildId, config] of entries) {
      if (!config?.quranRadioEnabled) continue;
      if (!config?.quranRadioVoiceChannelId) continue;
      const guild =
        client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) continue;
      const status = getStatus(guildId);
      if (status?.mode === "radio") continue;
      startRadio({
        guild,
        voiceChannelId: config.quranRadioVoiceChannelId,
        qariId: config.quranRadioQariId ?? 5,
        volume: config.quranRadioVolume ?? 0.35,
        startSurahId: config.quranDefaultSurahId ?? 1
      }).catch((error) => {
        console.error(`Failed to auto-start Quran radio in guild ${guildId}:`, error.message);
      });
    }
  }

  return {
    startRadio,
    playSurahOnce,
    playAyahRangeOnce,
    stopGuild,
    getStatus,
    ensureConfiguredRadios
  };
}

module.exports = {
  createQuranVoiceManager
};
