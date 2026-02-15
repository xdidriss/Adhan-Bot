const QURANICAUDIO_API_BASE = "https://quranicaudio.com/api";
const QURANICAUDIO_DOWNLOAD_BASE = "https://download.quranicaudio.com/quran/";
const EVERYAYAH_BASE = "https://everyayah.com/data/";
const EVERYAYAH_RECITATIONS_PAGE = "https://www.everyayah.com/recitations_ayat.html";

const CACHE_TTL_MS = {
  qaris: 24 * 60 * 60 * 1000,
  surahs: 7 * 24 * 60 * 60 * 1000,
  everyAyahReciters: 7 * 24 * 60 * 60 * 1000
};

function pad3(value) {
  const num = Math.max(0, Math.floor(Number(value)));
  return String(num).padStart(3, "0");
}

async function fetchJson(url, { timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function createCache() {
  let value = null;
  let fetchedAt = 0;
  return {
    getFresh(ttlMs) {
      if (!value) return null;
      if (Date.now() - fetchedAt > ttlMs) return null;
      return value;
    },
    set(next) {
      value = next;
      fetchedAt = Date.now();
    }
  };
}

const qarisCache = createCache();
const surahsCache = createCache();
const everyAyahRecitersCache = createCache();

async function getQaris() {
  const cached = qarisCache.getFresh(CACHE_TTL_MS.qaris);
  if (cached) return cached;
  const data = await fetchJson(`${QURANICAUDIO_API_BASE}/qaris`);
  const normalized = Array.isArray(data) ? data : [];
  normalized.sort((a, b) => {
    const nameA = String(a?.name || "").trim();
    const nameB = String(b?.name || "").trim();
    if (nameA && nameB) {
      const cmp = nameA.localeCompare(nameB, "en", { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    } else if (nameA) {
      return -1;
    } else if (nameB) {
      return 1;
    }
    const idA = Number(a?.id);
    const idB = Number(b?.id);
    if (Number.isFinite(idA) && Number.isFinite(idB)) return idA - idB;
    return 0;
  });
  qarisCache.set(normalized);
  return normalized;
}

async function getSurahs() {
  const cached = surahsCache.getFresh(CACHE_TTL_MS.surahs);
  if (cached) return cached;
  const data = await fetchJson(`${QURANICAUDIO_API_BASE}/surahs`);
  const normalized = Array.isArray(data) ? data : [];
  surahsCache.set(normalized);
  return normalized;
}

async function getQariById(qariId) {
  const id = Number(qariId);
  if (!Number.isFinite(id)) {
    return null;
  }
  const qaris = await getQaris();
  return qaris.find((qari) => Number(qari?.id) === id) || null;
}

function parseEveryAyahRecitersFromHtml(html) {
  const out = [];
  const text = String(html || "");
  // Recitations page uses: <strong>Alafasy 128kbps</strong> ... href="https://everyayah.com/data/Alafasy_128kbps/"
  const re =
    /<strong>\s*([^<]+?)\s*<\/strong>[\s\S]*?https?:\/\/everyayah\.com\/data\/([^\/"']+)\//g;
  let match;
  while ((match = re.exec(text))) {
    const label = String(match[1] || "").trim();
    const key = String(match[2] || "").trim();
    if (!label || !key) continue;
    out.push({ key, label });
  }

  const uniq = new Map();
  for (const entry of out) {
    if (!uniq.has(entry.key)) {
      uniq.set(entry.key, entry.label);
    }
  }
  return [...uniq.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function getEveryAyahReciters() {
  const cached = everyAyahRecitersCache.getFresh(CACHE_TTL_MS.everyAyahReciters);
  if (cached) return cached;

  try {
    const html = await (await fetch(EVERYAYAH_RECITATIONS_PAGE)).text();
    const parsed = parseEveryAyahRecitersFromHtml(html);
    if (parsed.length) {
      everyAyahRecitersCache.set(parsed);
      return parsed;
    }
  } catch (_error) {
    // fall back below
  }

  const fallback = [
    { key: "Alafasy_128kbps", label: "Alafasy 128kbps" },
    { key: "Abdul_Basit_Murattal_192kbps", label: "Abdul Basit Murattal 192kbps" },
    { key: "Husary_128kbps", label: "Husary 128kbps" },
    { key: "Minshawy_Murattal_128kbps", label: "Minshawy Murattal 128kbps" },
    { key: "Saood_ash-Shuraym_128kbps", label: "Sa`ud ash-Shuraym 128kbps" }
  ];
  everyAyahRecitersCache.set(fallback);
  return fallback;
}

function buildSurahMp3Url({ qariRelativePath, surahId }) {
  const relativePath = String(qariRelativePath || "");
  if (!relativePath) return null;
  const surah = Math.max(1, Math.min(114, Math.floor(Number(surahId))));
  return `${QURANICAUDIO_DOWNLOAD_BASE}${relativePath}${pad3(surah)}.mp3`;
}

function buildAyahMp3Url({ everyAyahReciterKey, surahId, ayahNumber }) {
  const key = String(everyAyahReciterKey || "").trim();
  if (!key) return null;
  const surah = Math.max(1, Math.min(114, Math.floor(Number(surahId))));
  const ayah = Math.max(1, Math.floor(Number(ayahNumber)));
  return `${EVERYAYAH_BASE}${encodeURIComponent(key)}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

module.exports = {
  getQaris,
  getSurahs,
  getEveryAyahReciters,
  getQariById,
  buildSurahMp3Url,
  buildAyahMp3Url
};
