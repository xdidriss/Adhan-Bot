const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getEncryptionKeyFromEnv,
  parseJsonFileContents,
  stringifyJsonForFile
} = require("../src/dataCipher");

test("stringify/parse roundtrip without encryption key", () => {
  const payload = { hello: "world", nested: { n: 7 } };
  const serialized = stringifyJsonForFile(payload);
  const parsed = parseJsonFileContents(serialized);
  assert.deepEqual(parsed, payload);
});

test("stringify/parse roundtrip with encryption key", () => {
  const key = Buffer.from("11".repeat(32), "hex");
  const payload = { userId: "123", enabled: true, values: [1, 2, 3] };
  const serialized = stringifyJsonForFile(payload, { key });
  assert.match(serialized, /"__encrypted": true/);
  const parsed = parseJsonFileContents(serialized, { key });
  assert.deepEqual(parsed, payload);
});

test("parsing encrypted payload without key throws", () => {
  const key = Buffer.from("22".repeat(32), "hex");
  const serialized = stringifyJsonForFile({ ok: true }, { key });
  assert.throws(
    () => parseJsonFileContents(serialized),
    /Data file is encrypted but DATA_ENCRYPTION_KEY is not set/
  );
});

test("invalid DATA_ENCRYPTION_KEY value throws", () => {
  const previous = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = "not-a-valid-key";
  try {
    assert.throws(
      () => getEncryptionKeyFromEnv(),
      /Invalid DATA_ENCRYPTION_KEY/
    );
  } finally {
    if (typeof previous === "undefined") {
      delete process.env.DATA_ENCRYPTION_KEY;
    } else {
      process.env.DATA_ENCRYPTION_KEY = previous;
    }
  }
});
