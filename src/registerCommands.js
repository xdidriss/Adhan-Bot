require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { buildCommands } = require("./commands");

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    throw new Error("Missing DISCORD_TOKEN or CLIENT_ID in .env");
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = buildCommands();

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Registered ${commands.length} guild commands for guild ${guildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`Registered ${commands.length} global commands.`);
}

main().catch((error) => {
  console.error("Failed to register commands:", error.message);
  process.exit(1);
});
