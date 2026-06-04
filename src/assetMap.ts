// 未來 PNG assets 將取代 PixelItemPlaceholder
// This asset map reserves space for future PNG overlays.

export type BaseKey = "base-1" | "base-2" | "base-3";

export const BASE_KEYS: BaseKey[] = ["base-1", "base-2", "base-3"];

export const baseShapeMap: Record<BaseKey, string> = {
  "base-1": "/base-1.png",
  "base-2": "/base-2.png",
  "base-3": "/base-3.png"
};

export function normalizeBaseKey(value: unknown): BaseKey {
  return BASE_KEYS.includes(value as BaseKey) ? (value as BaseKey) : "base-1";
}

export function getRandomBaseKey(): BaseKey {
  return BASE_KEYS[Math.floor(Math.random() * BASE_KEYS.length)];
}

const variantAssetMap: Record<string, Partial<Record<string, string[]>>> = {
  Indie: {
    clothes: ["/INDIE-clothes-A.png", "/INDIE-clothes-B.png"],
    headwear: ["/INDIE-headwear-A.png", "/INDIE-headwear-B.png"],
    shoes: ["/INDIE-shoes-A.png", "/INDIE-shoes-B.png"],
    enhance: ["/INDIE-enhance-A.png", "/INDIE-enhance-B.png"]
  },
  "Taiwan Indie": {
    clothes: ["/INDIE-clothes-A.png", "/INDIE-clothes-B.png"],
    headwear: ["/INDIE-headwear-A.png", "/INDIE-headwear-B.png"],
    shoes: ["/INDIE-shoes-A.png", "/INDIE-shoes-B.png"],
    enhance: ["/INDIE-enhance-A.png", "/INDIE-enhance-B.png"]
  }
};

const legacyAssetPathMap: Record<string, string[]> = {
  "Indie:clothes": ["/INDIE-clothes.png", "/INDIE-clothes-A.png", "/INDIE-clothes-B.png"],
  "Indie:headwear": ["/INDIE-headwear.png", "/INDIE-headwear-A.png", "/INDIE-headwear-B.png"],
  "Indie:shoes": ["/INDIE-shoes.png", "/INDIE-shoes-A.png", "/INDIE-shoes-B.png"],
  "Indie:enhance": ["/INDIE-enhance.png", "/INDIE-enhance-A.png", "/INDIE-enhance-B.png"],
  "Taiwan Indie:clothes": ["/INDIE-clothes.png", "/INDIE-clothes-A.png", "/INDIE-clothes-B.png"],
  "Taiwan Indie:headwear": ["/INDIE-headwear.png", "/INDIE-headwear-A.png", "/INDIE-headwear-B.png"],
  "Taiwan Indie:shoes": ["/INDIE-shoes.png", "/INDIE-shoes-A.png", "/INDIE-shoes-B.png"],
  "Taiwan Indie:enhance": ["/INDIE-enhance.png", "/INDIE-enhance-A.png", "/INDIE-enhance-B.png"]
};

function getSeededIndex(seed: string, length: number) {
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) {
    total = (total + seed.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return Math.abs(total) % length;
}

export function resolveAssetImage(genre: string, part: string, seed?: string) {
  const variants = variantAssetMap[genre]?.[part];
  if (variants && variants.length > 0) {
    if (!seed) {
      return variants[Math.floor(Math.random() * variants.length)];
    }
    return variants[getSeededIndex(seed, variants.length)];
  }

  return assetMap[genre]?.[part] || null;
}

export function getAssetErrorFallback(genre: string, part: string, currentSrc: string | null | undefined, seed?: string) {
  const variants = variantAssetMap[genre]?.[part] || [];
  const preferred = resolveAssetImage(genre, part, seed);

  if (preferred && preferred !== currentSrc) {
    return preferred;
  }

  if (variants.length > 1 && currentSrc) {
    const alternative = variants.find((variant) => variant !== currentSrc);
    if (alternative) {
      return alternative;
    }
  }

  return null;
}

export function normalizeStoredAssetImage(genre: string, part: string, imageSrc: string | null | undefined, seed?: string) {
  const legacyPaths = legacyAssetPathMap[`${genre}:${part}`];
  if (legacyPaths && (!imageSrc || legacyPaths.includes(imageSrc))) {
    return resolveAssetImage(genre, part, seed);
  }

  return imageSrc || resolveAssetImage(genre, part, seed);
}

export const genreToBaseType: Record<string, string> = {
  Pop: "base-1",
  Kpop: "base-1",
  "K-pop": "base-1",
  RnB: "base-1",
  RNB: "base-1",
  "R&B": "base-1",
  Jazz: "base-1",
  Hiphop: "base-2",
  "Hip-hop": "base-2",
  Rock: "base-2",
  EDM: "base-2",
  Country: "base-2",
  Classical: "base-3",
  "Taiwan Indie": "base-3",
  Indie: "base-3",
  Mixed: "base-1",
  Hidden: "base-1"
};

export const assetMap: Record<string, Record<string, string | null>> = {
  Classical: {
    clothes: "/CLASSICAL-clothes.png",
    headwear: "/CLASSICAL-headwear.png",
    accessory: "/CLASSICAL-accessory.png",
    handheld: "/CLASSICAL-handheld.png",
    shoes: "/CLASSICAL-shoes.png",
    enhance: "/CLASSICAL-enhance.png"
  },
  Country: {
    clothes: "/COUNTRY-clothes.png",
    headwear: "/COUNTRY-headwear.png",
    accessory: "/COUNTRY-accessory.png",
    handheld: "/COUNTRY-handheld.png",
    shoes: "/COUNTRY-shoes.png",
    enhance: "/COUNTRY-enhance.png"
  },
  EDM: {
    clothes: "/EDM-clothes.png",
    headwear: "/EDM-headwear.png",
    accessory: "/EDM-accessory.png",
    handheld: "/EDM-handheld.png",
    shoes: "/EDM-shoes.png",
    enhance: "/EDM-enhance.png"
  },
  Kpop: {
    clothes: "/KPOP-clothes.png",
    headwear: "/KPOP-headwear.png",
    accessory: "/KPOP-accessory.png",
    handheld: "/KPOP-handheld.png",
    shoes: "/KPOP-shoes.png",
    enhance: "/KPOP-enhance.png"
  },
  "K-pop": {
    clothes: "/KPOP-clothes.png",
    headwear: "/KPOP-headwear.png",
    accessory: "/KPOP-accessory.png",
    handheld: "/KPOP-handheld.png",
    shoes: "/KPOP-shoes.png",
    enhance: "/KPOP-enhance.png"
  },
  Pop: {
    clothes: "/POP-clothes.png",
    headwear: "/POP-headwear.png",
    accessory: "/POP-accessory.png",
    handheld: "/POP-handheld.png",
    shoes: "/POP-shoes.png",
    enhance: "/POP-enhance.png"
  },
  RnB: {
    clothes: "/RNB-clothes.png",
    headwear: "/RNB-headwear.png",
    accessory: "/RNB-accessory.png",
    handheld: "/RNB-handheld.png",
    shoes: "/RNB-shoes.png",
    enhance: "/RNB-enhance.png"
  },
  "R&B": {
    clothes: "/RNB-clothes.png",
    headwear: "/RNB-headwear.png",
    accessory: "/RNB-accessory.png",
    handheld: "/RNB-handheld.png",
    shoes: "/RNB-shoes.png",
    enhance: "/RNB-enhance.png"
  },
  Rock: {
    clothes: "/ROCK-clothes.png",
    headwear: "/ROCK-headwear.png",
    accessory: "/ROCK-accessory.png",
    handheld: "/ROCK-handheld.png",
    shoes: "/ROCK-shoes.png",
    enhance: "/ROCK-enhance.png"
  },
  Jazz: {
    clothes: "/JAZZ-clothes.png",
    headwear: "/JAZZ-headwear.png",
    accessory: "/JAZZ-accessory.png",
    handheld: "/JAZZ-handheld.png",
    shoes: "/JAZZ-shoes.png",
    enhance: "/JAZZ-enhance.png"
  },
  Indie: {
    clothes: "/INDIE-clothes-A.png",
    headwear: "/INDIE-headwear-A.png",
    accessory: "/INDIE-accessory.png",
    handheld: "/INDIE-handheld.png",
    shoes: "/INDIE-shoes-A.png",
    enhance: "/INDIE-enhance-A.png"
  },
  "Taiwan Indie": {
    clothes: "/INDIE-clothes-A.png",
    headwear: "/INDIE-headwear-A.png",
    accessory: "/INDIE-accessory.png",
    handheld: "/INDIE-handheld.png",
    shoes: "/INDIE-shoes-A.png",
    enhance: "/INDIE-enhance-A.png"
  },
  Hiphop: {
    clothes: "/HIPHOP-clothes.png",
    headwear: "/HIPHOP-headwear.png",
    accessory: "/HIPHOP-accessory.png",
    handheld: "/HIPHOP-handheld.png",
    shoes: "/HIPHOP-shoes.png",
    enhance: "/HIPHOP-enhance.png"
  },
  "Hip-hop": {
    clothes: "/HIPHOP-clothes.png",
    headwear: "/HIPHOP-headwear.png",
    accessory: "/HIPHOP-accessory.png",
    handheld: "/HIPHOP-handheld.png",
    shoes: "/HIPHOP-shoes.png",
    enhance: "/HIPHOP-enhance.png"
  },
  base: {
    1: "/base-1.png",
    2: "/base-2.png",
    3: "/base-3.png"
  }
};
