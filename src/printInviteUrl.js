require("dotenv").config();

const clientId = process.env.CLIENT_ID;
const permissions = process.env.BOT_PERMISSIONS || "2322443439053888";

if (!clientId) {
  console.error("Missing CLIENT_ID in .env");
  process.exit(1);
}

const inviteUrl = new URL("https://discord.com/oauth2/authorize");
inviteUrl.searchParams.set("client_id", clientId);
inviteUrl.searchParams.set("permissions", permissions);
inviteUrl.searchParams.set("integration_type", "0");
inviteUrl.searchParams.set("scope", "bot applications.commands");

console.log(inviteUrl.toString());
