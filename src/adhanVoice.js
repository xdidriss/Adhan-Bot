const fs = require("node:fs");
const path = require("node:path");
const { PermissionsBitField } = require("discord.js");

const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} = require("@discordjs/voice");

try {
  const ffmpegPath = require("ffmpeg-static");
  if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
  }
} catch (_error) {
  // Optional dependency at runtime.
}

async function playAdhanInVoice({ guild, voiceChannelId, audioFilePath }) {
  const ADHAN_VOLUME = 0.5;
  const resolvedPath = path.resolve(audioFilePath);
  if (!fs.existsSync(resolvedPath)) {
    return { ok: false, reason: `Audio file not found at ${resolvedPath}` };
  }

  const channel = await guild.channels.fetch(voiceChannelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) {
    return { ok: false, reason: "Configured voice channel no longer exists." };
  }

  const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    return { ok: false, reason: "Bot member not available in this guild." };
  }

  const permissions = channel.permissionsFor(me);
  if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
    return { ok: false, reason: "Bot is missing Connect permission in the voice channel." };
  }
  if (!permissions?.has(PermissionsBitField.Flags.Speak)) {
    return { ok: false, reason: "Bot is missing Speak permission in the voice channel." };
  }

  const existingConnection = getVoiceConnection(guild.id);
  if (existingConnection) {
    existingConnection.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(resolvedPath, { inlineVolume: true });
  resource.volume?.setVolume(ADHAN_VOLUME);
  const subscription = connection.subscribe(player);
  if (!subscription) {
    connection.destroy();
    return { ok: false, reason: "Failed to subscribe audio player to voice connection." };
  }

  let lastPlayerError = null;
  let lastConnectionError = null;

  player.on("error", (error) => {
    lastPlayerError = error;
    console.error(`Audio player error in guild ${guild.id}:`, error.message);
    connection.destroy();
  });

  connection.on("error", (error) => {
    lastConnectionError = error;
    console.error(`Voice connection error in guild ${guild.id}:`, error.message);
    connection.destroy();
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    player.play(resource);
    await entersState(player, AudioPlayerStatus.Playing, 10_000);
  } catch (error) {
    connection.destroy();
    const detail =
      lastPlayerError?.message ||
      lastConnectionError?.message ||
      error.message ||
      "Unknown playback startup error";
    return { ok: false, reason: `Unable to start voice playback: ${detail}` };
  }

  player.once(AudioPlayerStatus.Idle, () => {
    connection.destroy();
  });

  // Safety fallback in case Idle never fires.
  setTimeout(() => {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  }, 10 * 60 * 1000);

  return { ok: true };
}

module.exports = {
  playAdhanInVoice
};
