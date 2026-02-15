const crypto = require("node:crypto");

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALG = "aes-256-gcm";

function parseEncryptionKey(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return null;
  }

  // Prefer explicit 32-byte keys via hex/base64.
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // Base64-encoded 32 bytes.
  try {
    const asB64 = Buffer.from(trimmed, "base64");
    if (asB64.length === 32) {
      return asB64;
    }
  } catch {
    // ignore
  }

  throw new Error("Invalid DATA_ENCRYPTION_KEY. Use 64 hex chars or base64 for 32 bytes.");
}

function getEncryptionKeyFromEnv() {
  return parseEncryptionKey(process.env.DATA_ENCRYPTION_KEY);
}

function isEncryptedEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.__encrypted === true &&
      value.v === ENVELOPE_VERSION &&
      value.alg === ENVELOPE_ALG &&
      typeof value.iv === "string" &&
      typeof value.tag === "string" &&
      typeof value.data === "string"
  );
}

function encryptJsonString(jsonString, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENVELOPE_ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(jsonString, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __encrypted: true,
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64")
  };
}

function decryptToJsonString(envelope, key) {
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.data, "base64");
  const decipher = crypto.createDecipheriv(ENVELOPE_ALG, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function parseJsonFileContents(raw, { key } = {}) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed);
  if (!isEncryptedEnvelope(parsed)) {
    return parsed;
  }

  if (!key) {
    throw new Error("Data file is encrypted but DATA_ENCRYPTION_KEY is not set.");
  }

  const decryptedJson = decryptToJsonString(parsed, key);
  return decryptedJson.trim() ? JSON.parse(decryptedJson) : {};
}

function stringifyJsonForFile(value, { key } = {}) {
  const jsonString = `${JSON.stringify(value, null, 2)}\n`;
  if (!key) {
    return jsonString;
  }
  const encrypted = encryptJsonString(jsonString, key);
  return `${JSON.stringify(encrypted, null, 2)}\n`;
}

module.exports = {
  getEncryptionKeyFromEnv,
  parseJsonFileContents,
  stringifyJsonForFile
};

