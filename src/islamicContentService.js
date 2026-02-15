const HADITH_GRADE_SCORES = {
  sahih: 0,
  hasan: 1,
  weak: 2
};

const CONTENT_LANGUAGE_LABELS = {
  english: "English",
  arabic: "Arabic"
};

const CONTENT_LANGUAGE_CHOICES = [
  { name: "English", value: "english" },
  { name: "Arabic", value: "arabic" }
];

const HADITH_GRADE_LABELS = {
  sahih: "Sahih",
  hasan: "Hasan",
  weak: "Weak"
};

const HADITH_MIN_GRADE_CHOICES = [
  { name: "Sahih only", value: "sahih" },
  { name: "Sahih and Hasan", value: "hasan" },
  { name: "Include weak", value: "weak" }
];

const BASE_AZKAR_ENTRIES = [
  {
    id: "azkar-001",
    text: "SubhanAllahi wa bihamdihi.",
    textArabic: "سبحان الله وبحمده.",
    source: "Sahih al-Bukhari 6405, Sahih Muslim 2691"
  },
  {
    id: "azkar-002",
    text: "SubhanAllahi al-'Azim.",
    textArabic: "سبحان الله العظيم.",
    source: "Sahih al-Bukhari 6405"
  },
  {
    id: "azkar-003",
    text: "La ilaha illa Allah wahdahu la sharika lah, lahul-mulk wa lahul-hamd wa Huwa 'ala kulli shay'in qadir.",
    textArabic: "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.",
    source: "Sahih al-Bukhari 3293, Sahih Muslim 2691"
  },
  {
    id: "azkar-004",
    text: "Astaghfirullah wa atubu ilayh.",
    textArabic: "أستغفر الله وأتوب إليه.",
    source: "Sahih al-Bukhari 6307"
  },
  {
    id: "azkar-005",
    text: "Allahumma salli 'ala Muhammad.",
    textArabic: "اللهم صل على محمد.",
    source: "Sahih al-Bukhari 6357, Sahih Muslim 406"
  },
  {
    id: "azkar-006",
    text: "Hasbunallahu wa ni'mal wakil.",
    textArabic: "حسبنا الله ونعم الوكيل.",
    source: "Sahih al-Bukhari 4563"
  },
  {
    id: "azkar-007",
    text: "La hawla wa la quwwata illa billah.",
    textArabic: "لا حول ولا قوة إلا بالله.",
    source: "Sahih al-Bukhari 4205, Sahih Muslim 2704"
  },
  {
    id: "azkar-008",
    text: "Allahumma inni as'aluka al-'afwa wal-'afiyah.",
    textArabic: "اللهم إني أسألك العفو والعافية.",
    source: "Sunan Ibn Majah 3871 (Hasan)"
  },
  {
    id: "azkar-009",
    text: "Rabbi zidni 'ilma.",
    textArabic: "رب زدني علما.",
    source: "Quran 20:114"
  },
  {
    id: "azkar-010",
    text: "Rabbana atina fid-dunya hasanah wa fil-akhirati hasanah wa qina 'adhaban-nar.",
    textArabic: "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.",
    source: "Quran 2:201"
  },
  {
    id: "azkar-011",
    text: "Allahumma anta as-salam wa minka as-salam tabarakta ya dhal-jalali wal-ikram.",
    textArabic: "اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام.",
    source: "Sahih Muslim 591"
  },
  {
    id: "azkar-012",
    text: "Bismillah alladhi la yadurru ma'a ismihi shay'un fil-ardi wa la fis-sama'.",
    textArabic: "بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم.",
    source: "Sunan Abi Dawud 5088 (Hasan)"
  },
  {
    id: "azkar-013",
    text: "Radiytu billahi Rabban wa bil-Islami dinan wa bi-Muhammadin nabiyya.",
    textArabic: "رضيت بالله ربا وبالإسلام دينا وبمحمد نبيا.",
    source: "Sunan Abi Dawud 5072 (Hasan)"
  },
  {
    id: "azkar-014",
    text: "Ya muqallibal-qulub, thabbit qalbi 'ala dinik.",
    textArabic: "يا مقلب القلوب ثبت قلبي على دينك.",
    source: "Jami` at-Tirmidhi 2140 (Hasan)"
  },
  {
    id: "azkar-015",
    text: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal.",
    textArabic: "اللهم إني أعوذ بك من الهم والحزن، والعجز والكسل.",
    source: "Sahih al-Bukhari 6369"
  },
  {
    id: "azkar-016",
    text: "A'udhu bi kalimatillahi at-tammati min sharri ma khalaq.",
    textArabic: "أعوذ بكلمات الله التامات من شر ما خلق.",
    source: "Sahih Muslim"
  },
  {
    id: "azkar-017",
    text: "SubhanAllahi wal-hamdu lillahi wa la ilaha illa Allahu wallahu akbar.",
    textArabic: "سبحان الله والحمد لله ولا إله إلا الله والله أكبر.",
    source: "Sahih Muslim"
  },
  {
    id: "azkar-018",
    text: "La ilaha illa Anta, Subhanaka, inni kuntu minaz-zalimin.",
    textArabic: "لا إله إلا أنت سبحانك إني كنت من الظالمين.",
    source: "Quran 21:87"
  },
  {
    id: "azkar-019",
    text: "Allahummaghfir li, warhamni, wahdini, wa 'afini, warzuqni.",
    textArabic: "اللهم اغفر لي وارحمني واهدني وعافني وارزقني.",
    source: "Sahih Muslim"
  },
  {
    id: "azkar-020",
    text: "Allahumma innaka 'afuwwun tuhibbul-'afwa fa'fu 'anni.",
    textArabic: "اللهم إنك عفو تحب العفو فاعف عني.",
    source: "Jami` at-Tirmidhi"
  },
  {
    id: "azkar-021",
    text: "Rabbana la tuzigh qulubana ba'da idh hadaytana wa hab lana min ladunka rahmah.",
    textArabic: "ربنا لا تزغ قلوبنا بعد إذ هديتنا وهب لنا من لدنك رحمة.",
    source: "Quran 3:8"
  },
  {
    id: "azkar-022",
    text: "Hasbiya Allahu la ilaha illa Huwa, 'alayhi tawakkaltu wa Huwa Rabbul-'Arshil-'Azim.",
    textArabic: "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم.",
    source: "Quran 9:129"
  }
];

function pad3(value) {
  return String(value).padStart(3, "0");
}

function buildExpandedAzkarEntries(baseEntries, desiredCount = 100) {
  const base = Array.isArray(baseEntries) ? baseEntries : [];
  if (base.length >= desiredCount) {
    return base;
  }

  const existingArabic = new Set(base.map((entry) => String(entry?.textArabic || "").trim()).filter(Boolean));
  const existingEnglish = new Set(base.map((entry) => String(entry?.text || "").trim()).filter(Boolean));
  const out = [...base];
  let nextIndex = out.length + 1;

  const atoms = [
    { en: "SubhanAllah", ar: "سبحان الله" },
    { en: "Alhamdulillah", ar: "الحمد لله" },
    { en: "Allahu Akbar", ar: "الله أكبر" },
    { en: "La ilaha illa Allah", ar: "لا إله إلا الله" },
    { en: "Astaghfirullah", ar: "أستغفر الله" },
    { en: "La hawla wa la quwwata illa billah", ar: "لا حول ولا قوة إلا بالله" },
    { en: "Hasbunallahu wa ni'mal wakil", ar: "حسبنا الله ونعم الوكيل" },
    { en: "Bismillah", ar: "بسم الله" },
    { en: "Inna lillahi wa inna ilayhi raji'un", ar: "إنا لله وإنا إليه راجعون" },
    { en: "Allahumma salli 'ala Muhammad", ar: "اللهم صل على محمد" }
  ];

  const combos = [];
  for (let i = 0; i < atoms.length; i += 1) {
    combos.push([atoms[i]]);
  }
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = 0; j < atoms.length; j += 1) {
      if (i === j) continue;
      combos.push([atoms[i], atoms[j]]);
    }
  }
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = 0; j < atoms.length; j += 1) {
      if (i === j) continue;
      for (let k = 0; k < atoms.length; k += 1) {
        if (k === i || k === j) continue;
        combos.push([atoms[i], atoms[j], atoms[k]]);
      }
    }
  }

  for (const combo of combos) {
    if (out.length >= desiredCount) break;
    const text = combo.map((atom) => atom.en).join(" / ");
    const textArabic = combo.map((atom) => atom.ar).join(" / ");
    if (existingArabic.has(textArabic) || existingEnglish.has(text)) {
      continue;
    }

    existingArabic.add(textArabic);
    existingEnglish.add(text);
    out.push({
      id: `azkar-${pad3(nextIndex)}`,
      text,
      textArabic,
      source: "General dhikr"
    });
    nextIndex += 1;
  }

  return out;
}

const AZKAR_ENTRIES = buildExpandedAzkarEntries(BASE_AZKAR_ENTRIES, 100);

const HADITH_ENTRIES = [
  {
    id: "hadith-001",
    text: "Actions are judged by intentions, and every person will have only what they intended.",
    textArabic: "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى.",
    source: "Sahih al-Bukhari 1, Sahih Muslim 1907",
    grade: "sahih"
  },
  {
    id: "hadith-002",
    text: "The best among you are those with the best manners and character.",
    textArabic: "خيركم أحسنكم أخلاقا.",
    source: "Sahih al-Bukhari 3559",
    grade: "sahih"
  },
  {
    id: "hadith-003",
    text: "None of you truly believes until he loves for his brother what he loves for himself.",
    textArabic: "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه.",
    source: "Sahih al-Bukhari 13, Sahih Muslim 45",
    grade: "sahih"
  },
  {
    id: "hadith-004",
    text: "Whoever believes in Allah and the Last Day should speak good or remain silent.",
    textArabic: "من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت.",
    source: "Sahih al-Bukhari 6018, Sahih Muslim 47",
    grade: "sahih"
  },
  {
    id: "hadith-005",
    text: "Allah is gentle and loves gentleness in all matters.",
    textArabic: "إن الله رفيق يحب الرفق في الأمر كله.",
    source: "Sahih al-Bukhari 6927, Sahih Muslim 2165",
    grade: "sahih"
  },
  {
    id: "hadith-006",
    text: "True strength is controlling yourself when angry.",
    textArabic: "ليس الشديد بالصرعة إنما الشديد الذي يملك نفسه عند الغضب.",
    source: "Sahih al-Bukhari 6114, Sahih Muslim 2609",
    grade: "sahih"
  },
  {
    id: "hadith-007",
    text: "Make things easy and do not make them difficult; give glad tidings and do not drive people away.",
    textArabic: "يسروا ولا تعسروا وبشروا ولا تنفروا.",
    source: "Sahih al-Bukhari 69, Sahih Muslim 1734",
    grade: "sahih"
  },
  {
    id: "hadith-008",
    text: "The deeds most loved by Allah are those done consistently, even if small.",
    textArabic: "أحب الأعمال إلى الله أدومها وإن قل.",
    source: "Sahih al-Bukhari 6465, Sahih Muslim 783",
    grade: "sahih"
  },
  {
    id: "hadith-009",
    text: "Whoever seeks knowledge, Allah will make a path to Paradise easy for them.",
    textArabic: "من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة.",
    source: "Sahih Muslim 2699",
    grade: "sahih"
  },
  {
    id: "hadith-010",
    text: "Show mercy to those on earth; the One above the heavens will show mercy to you.",
    textArabic: "الراحمون يرحمهم الرحمن، ارحموا من في الأرض يرحمكم من في السماء.",
    source: "Jami` at-Tirmidhi 1924",
    grade: "hasan"
  },
  {
    id: "hadith-011",
    text: "The most beloved places to Allah are the masajid, and the most disliked places are the markets.",
    textArabic: "أحب البلاد إلى الله مساجدها وأبغض البلاد إلى الله أسواقها.",
    source: "Sahih Muslim 671",
    grade: "sahih"
  },
  {
    id: "hadith-012",
    text: "A believing man should not hate a believing woman; if he dislikes one trait, he should be pleased with another.",
    textArabic: "لا يفرك مؤمن مؤمنة إن كره منها خلقا رضي منها آخر.",
    source: "Sahih Muslim 1469",
    grade: "sahih"
  },
  {
    id: "hadith-013",
    text: "Part of the excellence of one's Islam is leaving what does not concern them.",
    textArabic: "من حسن إسلام المرء تركه ما لا يعنيه.",
    source: "Jami` at-Tirmidhi 2317",
    grade: "hasan"
  },
  {
    id: "hadith-014",
    text: "Smiling at your brother is charity.",
    textArabic: "تبسمك في وجه أخيك صدقة.",
    source: "Jami` at-Tirmidhi 1956",
    grade: "hasan"
  },
  {
    id: "hadith-015",
    text: "The world is a provision, and the best provision in it is a righteous spouse.",
    textArabic: "الدنيا متاع وخير متاع الدنيا المرأة الصالحة.",
    source: "Sahih Muslim 1467",
    grade: "sahih"
  },
  {
    id: "hadith-016",
    text: "Religion is sincere counsel.",
    textArabic: "الدين النصيحة.",
    source: "Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-017",
    text: "Purification is part of faith.",
    textArabic: "الطهور شطر الإيمان.",
    source: "Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-018",
    text: "Allah looks at your hearts and your deeds.",
    textArabic: "إن الله لا ينظر إلى صوركم وأموالكم ولكن ينظر إلى قلوبكم وأعمالكم.",
    source: "Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-019",
    text: "A good word is charity.",
    textArabic: "والكلمة الطيبة صدقة.",
    source: "Sahih al-Bukhari, Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-020",
    text: "Do not envy and do not hate; be servants of Allah as brothers.",
    textArabic: "لا تحاسدوا ولا تباغضوا وكونوا عباد الله إخوانا.",
    source: "Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-021",
    text: "Beware of suspicion; suspicion is the most false form of speech.",
    textArabic: "إياكم والظن فإن الظن أكذب الحديث.",
    source: "Sahih al-Bukhari, Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-022",
    text: "The most beloved words to Allah are: SubhanAllah, Alhamdulillah, La ilaha illa Allah, Allahu Akbar.",
    textArabic: "أحب الكلام إلى الله أربع: سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر.",
    source: "Sahih Muslim",
    grade: "sahih"
  },
  {
    id: "hadith-023",
    text: "The best of you are the best to their families.",
    textArabic: "خيركم خيركم لأهله.",
    source: "Jami` at-Tirmidhi",
    grade: "hasan"
  },
  {
    id: "hadith-024",
    text: "Whoever does not thank people has not truly thanked Allah.",
    textArabic: "من لا يشكر الناس لا يشكر الله.",
    source: "Jami` at-Tirmidhi",
    grade: "hasan"
  },
  {
    id: "hadith-025",
    text: "Allah has prescribed excellence in everything.",
    textArabic: "إن الله كتب الإحسان على كل شيء.",
    source: "Sahih Muslim",
    grade: "sahih"
  }
];

function normalizeHadithGrade(value) {
  const normalized = String(value || "sahih").trim().toLowerCase();
  if (Object.hasOwn(HADITH_GRADE_SCORES, normalized)) {
    return normalized;
  }
  return "sahih";
}

function normalizeContentLanguage(value) {
  const normalized = String(value || "english").trim().toLowerCase();
  if (Object.hasOwn(CONTENT_LANGUAGE_LABELS, normalized)) {
    return normalized;
  }
  return "english";
}

function getEntryTextByLanguage(entry, language) {
  const normalizedLanguage = normalizeContentLanguage(language);
  if (normalizedLanguage === "arabic" && typeof entry?.textArabic === "string" && entry.textArabic.trim().length > 0) {
    return entry.textArabic;
  }
  return entry?.text || "";
}

function gradePassesMinimum(grade, minimumGrade) {
  const normalizedGrade = normalizeHadithGrade(grade);
  const normalizedMinimum = normalizeHadithGrade(minimumGrade);
  return HADITH_GRADE_SCORES[normalizedGrade] <= HADITH_GRADE_SCORES[normalizedMinimum];
}

function pickRandomEntry(entries, recentIds = [], maxHistory = 20) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("No entries available.");
  }

  const validEntryIdSet = new Set(entries.map((entry) => entry.id));
  const trimmedHistory = Array.isArray(recentIds) ? recentIds.filter((id) => validEntryIdSet.has(id)) : [];

  // Keep a long anti-repeat window so we cycle through most entries before reusing one.
  const antiRepeatWindow = Math.max(1, entries.length - 1);
  const recentWindowIds = trimmedHistory.slice(-antiRepeatWindow);
  const recentWindowSet = new Set(recentWindowIds);

  let pool = entries.filter((entry) => !recentWindowSet.has(entry.id));
  if (pool.length === 0) {
    // Fallback: still avoid back-to-back duplicates after a full cycle.
    const lastId = trimmedHistory[trimmedHistory.length - 1];
    pool = entries.filter((entry) => entry.id !== lastId);
    if (pool.length === 0) {
      pool = entries;
    }
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  const historyRetention = Math.max(Math.max(1, maxHistory), antiRepeatWindow);
  const nextRecentIds = [...trimmedHistory, selected.id].slice(-historyRetention);

  return {
    entry: selected,
    nextRecentIds
  };
}

function getRandomAzkar({ recentIds = [], maxHistory = 20 } = {}) {
  return pickRandomEntry(AZKAR_ENTRIES, recentIds, maxHistory);
}

function getRandomHadith({ recentIds = [], minGrade = "sahih", maxHistory = 20 } = {}) {
  const normalizedMinGrade = normalizeHadithGrade(minGrade);
  const filtered = HADITH_ENTRIES.filter((entry) => gradePassesMinimum(entry.grade, normalizedMinGrade));
  if (filtered.length === 0) {
    throw new Error(`No hadith entries available for grade ${normalizedMinGrade}.`);
  }

  return pickRandomEntry(filtered, recentIds, maxHistory);
}

module.exports = {
  AZKAR_ENTRIES,
  CONTENT_LANGUAGE_CHOICES,
  CONTENT_LANGUAGE_LABELS,
  HADITH_ENTRIES,
  HADITH_GRADE_LABELS,
  HADITH_MIN_GRADE_CHOICES,
  getEntryTextByLanguage,
  getRandomAzkar,
  getRandomHadith,
  normalizeContentLanguage,
  normalizeHadithGrade
};
