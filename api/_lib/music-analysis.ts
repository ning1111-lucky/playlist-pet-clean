import type { DailyMusicData, Genre } from "../../src/types";

const GENRE_RULES: Array<{ genre: Genre; keywords: string[] }> = [
  { genre: "Kpop", keywords: ["k-pop", "kpop", "korean pop"] },
  { genre: "Hiphop", keywords: ["hip hop", "hip-hop", "rap", "trap", "drill", "boom bap"] },
  { genre: "RnB", keywords: ["r&b", "rnb", "neo soul", "soul"] },
  { genre: "EDM", keywords: ["edm", "house", "techno", "trance", "dance", "electro", "dubstep"] },
  { genre: "Classical", keywords: ["classical", "baroque", "orchestral", "piano", "chamber", "symphony"] },
  { genre: "Jazz", keywords: ["jazz", "swing", "bebop", "fusion", "blues"] },
  { genre: "Country", keywords: ["country", "americana", "bluegrass", "folk"] },
  { genre: "Rock", keywords: ["rock", "metal", "punk", "grunge", "alt rock", "alternative rock"] },
  { genre: "Indie", keywords: ["indie", "shoegaze", "lo-fi", "bedroom pop", "dream pop", "taiwan indie"] },
  { genre: "Pop", keywords: ["pop", "synthpop", "idol"] },
];

export function normalizeAppGenre(value: string): Genre {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return "Pop";

  for (const rule of GENRE_RULES) {
    if (rule.keywords.some((keyword) => lowered.includes(keyword))) {
      return rule.genre;
    }
  }

  return "Pop";
}

function buildDistribution(rawGenres: string[]) {
  const counts = new Map<Genre, number>();

  rawGenres.forEach((rawGenre) => {
    const genre = normalizeAppGenre(rawGenre);
    counts.set(genre, (counts.get(genre) || 0) + 1);
  });

  if (counts.size === 0) {
    counts.set("Pop", 1);
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const entries = Array.from(counts.entries())
    .map(([genre, count]) => ({
      genre,
      percentage: Math.max(1, Math.round((count / total) * 100)),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const percentageTotal = entries.reduce((sum, entry) => sum + entry.percentage, 0);
  if (percentageTotal !== 100 && entries[0]) {
    entries[0].percentage = Math.max(1, entries[0].percentage + (100 - percentageTotal));
  }

  return entries;
}

export function buildDailyMusicData(options: {
  songCount: number;
  rawGenres: string[];
  quote: string;
}): DailyMusicData {
  const distribution = buildDistribution(options.rawGenres);
  const hasAnyListeningData = Math.max(0, options.songCount || 0) > 0 || options.rawGenres.length > 0;
  const mainGenre = hasAnyListeningData ? distribution[0]?.genre || "Pop" : "Hidden";
  const subGenre = distribution[1]?.genre || mainGenre;

  return {
    songCount: Math.max(0, options.songCount || 0),
    mainGenre,
    subGenre,
    assetGenre: mainGenre,
    distribution: hasAnyListeningData ? distribution : [],
    quote: options.quote || (hasAnyListeningData ? `今天的音樂能量偏向 ${mainGenre}。` : "今天還沒有同步到新的音樂紀錄。"),
  };
}
