import { normalizeText, tamilPrefixMatch } from "@/lib/normalize";

/** One theme: how it reads to a user, and what typing triggers it. */
export interface ThemeEntry {
  label: string;
  triggers: string[];
  /**
   * Tamil triggers in ROOT form. They are matched by prefix, not equality, so
   * பொறுமை also catches பொறுமையாக, பொறுமையுடன் and the rest of the paradigm.
   */
  triggersTamil: string[];
}

/**
 * The closed theme vocabulary.
 *
 * Corpus records may only carry these slugs, so the lexicon and the data stay
 * in step: a typo in either surfaces as a theme that never matches rather than
 * as a silently invented category.
 *
 * Triggers are the words a user actually types about a situation, not synonyms
 * of the slug. Multi-word triggers are tested against the whole normalised
 * query; single words are tested against its tokens.
 */
export const THEME_LEXICON: Record<string, ThemeEntry> = {
  moderation: {
    label: "Moderation and excess",
    triggers: [
      "moderation",
      "overdo",
      "overdoing",
      "excess",
      "excessive",
      "too much",
      "binge",
      "limit",
      "restraint",
      "overindulge",
      "overwork",
      "overspend",
      "burnout",
    ],
    triggersTamil: ["அளவு", "அளவோடு", "மிகை", "அதிகம்", "கட்டுப்பாடு", "மிதம்"],
  },
  patience: {
    label: "Patience and timing",
    triggers: [
      "patience",
      "patient",
      "impatient",
      "wait",
      "waiting",
      "hurry",
      "rush",
      "rushing",
      "slow down",
      "take time",
      "in a hurry",
      "timing",
      "delay",
    ],
    triggersTamil: ["பொறுமை", "பொறுத்த", "காத்திரு", "அவசரம்", "நிதானம்", "தாமதம்", "சகிப்பு"],
  },
  consequences: {
    label: "Actions and consequences",
    triggers: [
      "consequence",
      "consequences",
      "result",
      "results",
      "reap",
      "payback",
      "karma",
      "backfire",
      "aftermath",
      "comes back",
      "own fault",
      "deserve",
      "punishment",
    ],
    triggersTamil: ["விளைவு", "பலன்", "தீவினை", "தண்டனை", "அறுவடை", "வினை"],
  },
  effort: {
    label: "Effort and perseverance",
    triggers: [
      "effort",
      "hard work",
      "hardwork",
      "persevere",
      "perseverance",
      "persistence",
      "practice",
      "keep going",
      "give up",
      "struggle",
      "diligence",
      "trying",
      "lazy",
    ],
    triggersTamil: ["முயற்சி", "உழைப்பு", "பயிற்சி", "விடாமுயற்சி", "சோம்பல்", "கடினம்", "உழைத்த"],
  },
  greed: {
    label: "Greed and contentment",
    triggers: [
      "greed",
      "greedy",
      "hoard",
      "hoarding",
      "never enough",
      "want everything",
      "selfish",
      "envy",
      "jealous",
      "insatiable",
      "more money",
      "content",
      "contentment",
    ],
    triggersTamil: ["பேராசை", "ஆசை", "பொறாமை", "சுயநலம்", "திருப்தி", "பேராவல்"],
  },
  unity: {
    label: "Unity and teamwork",
    triggers: [
      "unity",
      "together",
      "teamwork",
      "team",
      "cooperate",
      "cooperation",
      "collaboration",
      "community",
      "divided",
      "alone",
      "help each other",
      "family",
      "support",
    ],
    triggersTamil: ["ஒற்றுமை", "சேர்ந்து", "ஒன்றுபட", "கூட்டு", "ஒருமை", "சங்கம்", "இணைந்து"],
  },
  pride: {
    label: "Pride and arrogance",
    triggers: [
      "pride",
      "arrogant",
      "arrogance",
      "ego",
      "boast",
      "boasting",
      "brag",
      "bragging",
      "show off",
      "showing off",
      "vanity",
      "overconfident",
      "look down",
      "conceited",
    ],
    triggersTamil: ["தற்பெருமை", "கர்வம்", "ஆணவம்", "பெருமை", "தலைக்கனம்", "இறுமாப்பு"],
  },
  preparation: {
    label: "Preparation and foresight",
    triggers: [
      "prepare",
      "preparation",
      "plan",
      "planning",
      "ready",
      "foresight",
      "ahead of time",
      "last minute",
      "unprepared",
      "backup",
      "anticipate",
      "deadline",
      "forethought",
    ],
    triggersTamil: ["தயார்", "திட்டம்", "முன்னேற்பாடு", "முன்கூட்டி", "ஆயத்தம்", "எச்சரிக்கை"],
  },
  wisdom: {
    label: "Wisdom and learning",
    triggers: [
      "wisdom",
      "wise",
      "learn",
      "learning",
      "lesson",
      "experience",
      "advice",
      "knowledge",
      "elders",
      "teacher",
      "study",
      "insight",
      "understand",
    ],
    triggersTamil: ["அறிவு", "ஞானம்", "பாடம்", "அனுபவம்", "புத்தி", "ஆலோசனை", "கற்ற"],
  },
  appearances: {
    label: "Appearances and reality",
    triggers: [
      "appearance",
      "appearances",
      "looks",
      "deceive",
      "deceptive",
      "fake",
      "pretend",
      "superficial",
      "judge a book",
      "outward",
      "illusion",
      "mask",
      "first impression",
    ],
    triggersTamil: ["தோற்றம்", "வெளிப்பார்வை", "ஏமாற்று", "போலி", "நடிப்பு", "முகமூடி"],
  },
  thrift: {
    label: "Thrift and saving",
    triggers: [
      "thrift",
      "frugal",
      "save",
      "saving",
      "savings",
      "waste",
      "wasting",
      "spending",
      "budget",
      "expense",
      "expenses",
      "debt",
      "loan",
    ],
    triggersTamil: ["சிக்கனம்", "சேமி", "வீண்", "செலவு", "கடன்", "மிச்சம்"],
  },
  gratitude: {
    label: "Gratitude and repaying kindness",
    triggers: [
      "gratitude",
      "grateful",
      "thankful",
      "ungrateful",
      "favour",
      "favor",
      "kindness",
      "repay",
      "owe",
      "appreciate",
      "generosity",
      "helped me",
      "thank you",
    ],
    triggersTamil: ["நன்றி", "உபகாரம்", "நன்றிகெட்ட", "கைமாறு", "உதவி", "மறவாமை"],
  },
  humility: {
    label: "Humility and modesty",
    triggers: [
      "humble",
      "humility",
      "modest",
      "modesty",
      "down to earth",
      "simple living",
      "admit mistake",
      "learn from others",
      "respect others",
      "apologise",
      "apologize",
      "grounded",
    ],
    triggersTamil: ["பணிவு", "அடக்கம்", "எளிமை", "தாழ்மை", "மரியாதை", "மன்னிப்பு"],
  },
  adaptability: {
    label: "Adaptability and change",
    triggers: [
      "adapt",
      "adaptable",
      "adjust",
      "change",
      "changing",
      "flexible",
      "new place",
      "new job",
      "circumstances",
      "cope",
      "moving",
      "transition",
      "unfamiliar",
    ],
    triggersTamil: ["மாற்றம்", "பொருந்த", "சூழ்நிலை", "தகவமை", "சமாளி", "புதிது"],
  },
  speech: {
    label: "Speech and silence",
    triggers: [
      "speech",
      "speak",
      "speaking",
      "talk",
      "talking",
      "words",
      "silence",
      "silent",
      "quiet",
      "gossip",
      "tongue",
      "harsh words",
      "listen",
    ],
    triggersTamil: ["பேச்சு", "சொல்", "மௌனம்", "வார்த்தை", "நாக்கு", "வம்பு"],
  },
};

/**
 * Theme slugs a query touches.
 *
 * `tokens` should be raw tokens rather than stems: triggers are written as
 * whole words, so stemming them apart would silently drop matches. Tamil
 * triggers are compared by prefix for the same reason the scorer does it —
 * an inflected query word never equals a root.
 */
export function matchThemes(query: string, tokens: string[]): Set<string> {
  const normalized = normalizeText(query);
  const tokenSet = new Set(tokens);
  const matched = new Set<string>();

  for (const [slug, entry] of Object.entries(THEME_LEXICON)) {
    if (matchesEnglish(entry, normalized, tokenSet) || matchesTamil(entry, tokens)) {
      matched.add(slug);
    }
  }

  return matched;
}

function matchesEnglish(
  entry: ThemeEntry,
  normalized: string,
  tokenSet: ReadonlySet<string>,
): boolean {
  return entry.triggers.some((trigger) =>
    trigger.includes(" ") ? normalized.includes(trigger) : tokenSet.has(trigger),
  );
}

function matchesTamil(entry: ThemeEntry, tokens: string[]): boolean {
  return entry.triggersTamil.some((trigger) =>
    tokens.some((token) => tamilPrefixMatch(token, trigger)),
  );
}

/** Human-readable name for a theme, tolerating slugs added to data first. */
export function themeLabel(theme: string): string {
  const entry = THEME_LEXICON[theme];
  if (entry !== undefined) {
    return entry.label;
  }
  return theme
    .split(/[-_\s]+/u)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
