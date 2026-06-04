import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "../AppContext";
import { getBaseType, MOCK_MAP_ENTRIES } from "../mockData";
import { Genre, MapEntry, MusicItem } from "../types";
import { PetPlaceholder, PixelBadge, PixelIcon, PixelLogoTitle, PixelMap, PixelPetPreview, PixelProgress, PixelStatusBar, RetroWindow, getPartIconType } from "../components/UI";

type SafeMapEntry = {
  id: string;
  ownerName: string;
  city: string;
  country: string;
  petImage: string | null;
  petName: string;
  mainGenre: Genre;
  secondGenre: Genre;
  items: MusicItem[];
  description: string;
  baseType: "O" | "G" | "B";
  sourceDay?: number;
};

type GenreZoneKey = "kpop" | "classical" | "hiphop" | "country" | "jazz" | "indie" | "rnb" | "pop";

type ZoneConfig = {
  key: GenreZoneKey;
  slots: { left: string; top: string }[];
};

function normalizeMapEntryForView(entry: MapEntry): SafeMapEntry {
  const mainGenre = (entry.mainGenre || entry.pet?.mainGenre || "Pop") as Genre;
  const secondGenre = (entry.secondGenre || entry.pet?.subGenre || mainGenre) as Genre;
  const items = Array.isArray(entry.items) && entry.items.length > 0 ? entry.items : entry.pet?.items || [];

  return {
    id: entry.id || crypto.randomUUID(),
    ownerName: entry.ownerName || "Guest",
    city: entry.city || "Unknown",
    country: entry.country || "",
    petImage: entry.petImage || null,
    petName: entry.petName || entry.pet?.name || "未命名音樂寵物",
    mainGenre,
    secondGenre,
    items,
    description: entry.pet?.description || "這隻音樂寵物剛剛抵達世界地圖。",
    baseType: entry.pet?.baseType || getBaseType(mainGenre),
    sourceDay: entry.sourceDay,
  };
}

function getGenreZoneKey(genre: Genre): GenreZoneKey {
  const normalizedGenre = genre === "K-pop" ? "Kpop" : genre === "Hip-hop" ? "Hiphop" : genre === "R&B" ? "RnB" : genre;

  if (normalizedGenre === "Kpop") return "kpop";
  if (normalizedGenre === "Classical") return "classical";
  if (normalizedGenre === "Hiphop" || normalizedGenre === "Rock" || normalizedGenre === "EDM") return "hiphop";
  if (normalizedGenre === "Country") return "country";
  if (normalizedGenre === "Jazz") return "jazz";
  if (normalizedGenre === "Indie" || normalizedGenre === "Taiwan Indie") return "indie";
  if (normalizedGenre === "RnB") return "rnb";
  return "pop";
}

const zoneConfigs: ZoneConfig[] = [
  { key: "kpop", slots: [{ left: "18%", top: "28%" }, { left: "24%", top: "34%" }, { left: "28%", top: "22%" }] },
  { key: "classical", slots: [{ left: "50%", top: "28%" }, { left: "43%", top: "35%" }, { left: "57%", top: "35%" }] },
  { key: "hiphop", slots: [{ left: "78%", top: "28%" }, { left: "72%", top: "35%" }, { left: "84%", top: "35%" }] },
  { key: "country", slots: [{ left: "20%", top: "58%" }, { left: "28%", top: "63%" }, { left: "13%", top: "65%" }] },
  { key: "jazz", slots: [{ left: "50%", top: "55%" }, { left: "43%", top: "61%" }, { left: "58%", top: "62%" }] },
  { key: "indie", slots: [{ left: "79%", top: "58%" }, { left: "71%", top: "64%" }, { left: "86%", top: "65%" }] },
  { key: "rnb", slots: [{ left: "32%", top: "84%" }, { left: "23%", top: "78%" }, { left: "41%", top: "79%" }] },
  { key: "pop", slots: [{ left: "69%", top: "84%" }, { left: "61%", top: "78%" }, { left: "78%", top: "78%" }] },
];

export const MapView: React.FC = () => {
  const { mapEntries } = useApp();
  const [selectedEntry, setSelectedEntry] = useState<SafeMapEntry | null>(null);
  const safeMapEntries = Array.isArray(mapEntries) ? mapEntries.filter(Boolean) : [];

  const allEntries = [...MOCK_MAP_ENTRIES, ...safeMapEntries].map(normalizeMapEntryForView);
  const totalPets = allEntries.length;
  const genreCounts = allEntries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.mainGenre] = (acc[entry.mainGenre] || 0) + 1;
    return acc;
  }, {});
  const topGenre = Object.entries(genreCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "POP";
  const unlockedCount = Object.keys(genreCounts).length;
  const latestEntry = allEntries[allEntries.length - 1] || null;

  const entriesByZone = useMemo(() => {
    const grouped = zoneConfigs.reduce<Record<GenreZoneKey, SafeMapEntry[]>>((acc, zone) => {
      acc[zone.key] = [];
      return acc;
    }, {} as Record<GenreZoneKey, SafeMapEntry[]>);

    allEntries.forEach((entry) => {
      grouped[getGenreZoneKey(entry.mainGenre)].push(entry);
    });

    return grouped;
  }, [allEntries]);

  return (
    <div className="page-stack">
      <PixelStatusBar />
      <PixelLogoTitle kicker="WORLD MAP" title="音樂地圖" subtitle="把已解鎖的風格寵物放進世界地圖，沿著音樂能量繼續探索下一塊區域。" />

      <RetroWindow title="世界地圖" tone="blue">
        <PixelMap>
          <div className="relative w-full aspect-square overflow-hidden rounded-[18px] border-[3px] border-[var(--color-black)] bg-white shadow-[4px_4px_0_#111]">
            <img src="/genre-map.png" alt="Music genre map" className="absolute inset-0 h-full w-full object-cover" />
            {zoneConfigs.map((zone) =>
              (entriesByZone[zone.key] || []).map((entry, index) => {
                const slot = zone.slots[index % zone.slots.length];
                return (
                  <motion.button
                    key={entry.id}
                    type="button"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.32 }}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: slot.left, top: slot.top }}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="map-pet-pin">
                      {entry.petImage ? (
                        <img src={entry.petImage} alt={entry.petName} className="h-full w-full object-contain scale-[0.82]" />
                      ) : (
                        <PetPlaceholder baseType={entry.baseType} className="h-full w-full scale-[0.78]" />
                      )}
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </PixelMap>
      </RetroWindow>

      <RetroWindow title="今日已放置" tone="pink">
        <div className="window-stack-tight">
          <div className="window-title-row">
            <div>
              <div className="window-mini-title">{latestEntry ? `Day ${latestEntry.sourceDay || 1}` : "尚未放置"}</div>
              <p className="window-hint">{latestEntry ? `當前區域：${latestEntry.mainGenre}` : "完成今日孵化後，就能把寵物放進地圖世界。"}</p>
            </div>
            <PixelBadge tone="pink">{latestEntry?.mainGenre || "WAITING"}</PixelBadge>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="已解鎖區域" tone="yellow">
        <div className="window-stack-tight">
          <div className="window-title-row">
            <div className="window-mini-title">{unlockedCount} / 8</div>
            <PixelBadge tone="yellow">TOP：{topGenre}</PixelBadge>
          </div>
          <PixelProgress value={unlockedCount} max={8} color="var(--color-primary)" />
        </div>
      </RetroWindow>

      <RetroWindow title="探索獎勵" tone="green">
        <div className="reward-chip-grid">
          <div className="reward-chip inline-flex items-center gap-2"><PixelIcon type="coin" size={16} /> +120</div>
          <div className="reward-chip inline-flex items-center gap-2"><PixelIcon type="star" size={16} /> +10</div>
          <div className="reward-chip inline-flex items-center gap-2"><PixelIcon type="gem" size={16} /> +5</div>
        </div>
      </RetroWindow>

      <RetroWindow title="準備出發" tone="blue">
        <div className="window-stack-tight">
          <p className="window-copy">帶著你的音樂能量，前往新的音樂區域！點擊地圖上的寵物圖章，可以查看來自各地的 Playlist Pet。</p>
          <PixelBadge tone="green">OPEN MAP</PixelBadge>
        </div>
      </RetroWindow>

      <AnimatePresence>
        {selectedEntry ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="map-detail-overlay"
          >
            <RetroWindow title={selectedEntry.petName} tone="pink" className="map-detail-window">
              <div className="window-stack-tight">
                <div className="flex justify-center">
                  <PixelPetPreview imageSrc={selectedEntry.petImage} title={selectedEntry.petName} subtitle={`${selectedEntry.city}, ${selectedEntry.country || "Unknown"}`} />
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <PixelBadge tone="green">主風格：{selectedEntry.mainGenre}</PixelBadge>
                  <PixelBadge tone="yellow">次風格：{selectedEntry.secondGenre}</PixelBadge>
                </div>

                <p className="window-copy text-center">"{selectedEntry.description}"</p>

                <div className="day-collection-items justify-center">
                  {selectedEntry.items.length > 0 ? (
                    selectedEntry.items.map((item) => (
                    <span key={item.id} className="day-collection-chip inline-flex items-center gap-2">
                        <PixelIcon type={getPartIconType(item.part)} size={16} />
                        {item.label || `${item.genre} ${item.part}`}
                    </span>
                    ))
                  ) : (
                    <span className="day-collection-chip locked">沒有穿戴物品</span>
                  )}
                </div>

                <button type="button" className="pixel-button pixel-button-secondary w-full justify-center" onClick={() => setSelectedEntry(null)}>
                  CLOSE
                </button>
              </div>
            </RetroWindow>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
