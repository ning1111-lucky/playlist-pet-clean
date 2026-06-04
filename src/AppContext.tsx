import React, { createContext, useContext, useEffect, useState } from "react";
import {
  UserProfile,
  MusicItem,
  Pet,
  MapEntry,
  Genre,
  ItemPart,
  MusicProvider,
  DailyMusicData,
  HatchDayState,
  HatchSession,
  TrackRecord,
} from "./types";
import {
  COLLECTION_ITEM_PARTS,
  getBaseType,
  getCollectionSlotIndex,
  getDaySlotConfigs,
  MOCK_MAP_ENTRIES,
  TOTAL_DAYS,
} from "./mockData";
import { generateId } from "./utils";
import { BaseKey, getRandomBaseKey, normalizeBaseKey, normalizeStoredAssetImage, resolveAssetImage } from "./assetMap";

type DayIndex = 1 | 2 | 3;

interface FinalPetInput {
  sessionId: string;
  startDate: string;
  currentDay: number;
  days: Record<DayIndex, HatchDayState>;
  finalTracks: TrackRecord[];
}

interface AppState {
  userProfile: UserProfile | null;
  hatchSession: HatchSession;
  currentMockDay: number;
  currentBaseKey: BaseKey;
  currentWeekItems: (MusicItem | null)[];
  dailyHistory: MusicItem[];
  weeklyPets: Pet[];
  mapEntries: MapEntry[];
}

interface AppContextType extends AppState {
  login: (profile: UserProfile) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  generateItem: (item: MusicItem) => void;
  advanceDay: () => void;
  generateWeeklyPet: (pet: Pet) => void;
  resetWeek: () => void;
  addToMap: (entry: MapEntry) => void;
  autoFillWeek: () => Promise<void>;
  saveTracksForCurrentDay: (tracks: TrackRecord[], analysis?: DailyMusicData | null) => void;
  setCurrentDayAnalysis: (analysis: DailyMusicData | null) => void;
  getTracksForDay: (dayIndex: number) => TrackRecord[];
  getFinalPetInput: () => FinalPetInput;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = "melody_app_state";
const DAY_INDEXES: DayIndex[] = [1, 2, 3];
const INITIAL_ITEMS = Array.from({ length: COLLECTION_ITEM_PARTS.length }, () => null) as (MusicItem | null)[];
const VALID_GENRES: Genre[] = ["Pop", "Hip-hop", "Hiphop", "K-pop", "Kpop", "EDM", "Classical", "Jazz", "R&B", "RnB", "Country", "Rock", "Taiwan Indie", "Indie", "Mixed", "Hidden"];
const VALID_PARTS: ItemPart[] = ["clothes", "headwear", "accessory", "handheld", "shoes", "enhance", "final weekly pet"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addDaysToDateKey(dateKey: string, offset: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + offset);
  return toLocalDateKey(date);
}

function differenceInCalendarDaysLocal(later: Date, earlierDateKey: string) {
  const earlier = parseDateKey(earlierDateKey);
  const laterMidnight = parseDateKey(toLocalDateKey(later));
  const diff = laterMidnight.getTime() - earlier.getTime();
  return Math.floor(diff / 86400000);
}

export function getCurrentDay(startDate: string, today = new Date()) {
  const diffDays = differenceInCalendarDaysLocal(today, startDate);
  return Math.min(3, Math.max(1, diffDays + 1));
}

export function getDayDate(startDate: string, dayIndex: number) {
  return addDaysToDateKey(startDate, Math.min(Math.max(dayIndex, 1), TOTAL_DAYS) - 1);
}

function clampDayIndex(value: unknown): DayIndex {
  const numeric = Math.min(Math.max(Number(value) || 1, 1), TOTAL_DAYS);
  return (numeric === 1 ? 1 : numeric === 2 ? 2 : 3) as DayIndex;
}

function normalizeGenre(value: unknown): Genre {
  if (typeof value !== "string") return "Pop";

  const genreMap: Record<string, Genre> = {
    "K-pop": "Kpop",
    Kpop: "Kpop",
    KPOP: "Kpop",
    kpop: "Kpop",
    Pop: "Pop",
    POP: "Pop",
    pop: "Pop",
    "R&B": "RnB",
    RnB: "RnB",
    RNB: "RnB",
    rnb: "RnB",
    Rock: "Rock",
    ROCK: "Rock",
    rock: "Rock",
    Jazz: "Jazz",
    JAZZ: "Jazz",
    jazz: "Jazz",
    Indie: "Indie",
    INDIE: "Indie",
    indie: "Indie",
    "Taiwan Indie": "Indie",
    "Hip-hop": "Hiphop",
    Hiphop: "Hiphop",
    HIPHOP: "Hiphop",
    hiphop: "Hiphop",
    Classical: "Classical",
    CLASSICAL: "Classical",
    classical: "Classical",
    Country: "Country",
    COUNTRY: "Country",
    country: "Country",
    EDM: "EDM",
    edm: "EDM",
    Mixed: "Mixed",
    Hidden: "Hidden",
  };

  const normalized = genreMap[value] || (VALID_GENRES.includes(value as Genre) ? (value as Genre) : undefined);
  return normalized || "Pop";
}

function normalizePart(value: unknown, fallbackIndex = 0): ItemPart {
  if (typeof value === "string" && VALID_PARTS.includes(value as ItemPart)) {
    return value as ItemPart;
  }
  return COLLECTION_ITEM_PARTS[fallbackIndex] || "clothes";
}

function normalizeTrackRecord(value: unknown, provider: MusicProvider = "mock"): TrackRecord | null {
  if (!isRecord(value)) return null;

  const title =
    typeof value.title === "string"
      ? value.title.trim()
      : typeof value.name === "string"
        ? value.name.trim()
        : "";
  const artist = typeof value.artist === "string" ? value.artist.trim() : "";
  const playedAt = typeof value.playedAt === "string" ? value.playedAt.trim() : "";
  if (!title || !artist || !playedAt) return null;

  return {
    id: typeof value.id === "string" && value.id ? value.id : `${provider}-${artist}-${title}-${playedAt}`,
    title,
    artist,
    playedAt,
    provider: (typeof value.provider === "string" ? value.provider : provider) as MusicProvider,
  };
}

function dedupeTracks(tracks: TrackRecord[]) {
  const trackMap = new Map<string, TrackRecord>();
  tracks.forEach((track) => {
    const key = track.id || `${track.artist}:${track.title}:${track.playedAt}`;
    trackMap.set(key, track);
  });
  return Array.from(trackMap.values()).sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
}

function normalizeMusicItem(value: unknown, fallbackDay: DayIndex, fallbackDate?: string): MusicItem | null {
  if (!isRecord(value)) return null;

  const day = clampDayIndex(value.sourceDay ?? value.day ?? fallbackDay);
  const genre = normalizeGenre(value.genre);
  const part = normalizePart(value.part);
  const id = typeof value.id === "string" && value.id ? value.id : generateId();
  const sourceDate = typeof value.sourceDate === "string" && value.sourceDate ? value.sourceDate : fallbackDate || "";

  return {
    id,
    day,
    sourceDay: day,
    sourceDate,
    part,
    genre,
    label: typeof value.label === "string" && value.label ? value.label : `${genre} ${part}`,
    icon: typeof value.icon === "string" ? value.icon : "",
    imageSrc: normalizeStoredAssetImage(
      genre,
      part,
      typeof value.imageSrc === "string" && value.imageSrc ? value.imageSrc : null,
      `${id}:${day}`
    ),
  };
}

function createEmptyDay(date: string): HatchDayState {
  return {
    date,
    tracks: [],
    analysis: null,
    items: [],
    completed: false,
  };
}

function createNewHatchSession(startDate = toLocalDateKey(new Date())): HatchSession {
  return {
    sessionId: generateId(),
    startDate,
    currentDay: getCurrentDay(startDate),
    days: {
      1: createEmptyDay(getDayDate(startDate, 1)),
      2: createEmptyDay(getDayDate(startDate, 2)),
      3: createEmptyDay(getDayDate(startDate, 3)),
    },
  };
}

function normalizeHatchDayState(value: unknown, fallbackDate: string, dayIndex: DayIndex): HatchDayState {
  if (!isRecord(value)) {
    return createEmptyDay(fallbackDate);
  }

  const items = (Array.isArray(value.items) ? value.items : [])
    .map((item) => normalizeMusicItem(item, dayIndex, typeof value.date === "string" ? value.date : fallbackDate))
    .filter((item): item is MusicItem => Boolean(item));
  const tracks = (Array.isArray(value.tracks) ? value.tracks : [])
    .map((track) => normalizeTrackRecord(track))
    .filter((track): track is TrackRecord => Boolean(track));

  const date = typeof value.date === "string" && value.date ? value.date : fallbackDate;
  const completed = getDaySlotConfigs(dayIndex).every((slot) => items.some((item) => item.part === slot.part));

  return {
    date,
    tracks: dedupeTracks(tracks),
    analysis: isRecord(value.analysis) ? (value.analysis as DailyMusicData) : null,
    items,
    completed: typeof value.completed === "boolean" ? value.completed || completed : completed,
  };
}

function normalizeHatchSession(value: unknown): HatchSession {
  if (!isRecord(value)) {
    return createNewHatchSession();
  }

  const startDate = typeof value.startDate === "string" && value.startDate ? value.startDate : toLocalDateKey(new Date());
  const session = createNewHatchSession(startDate);
  const daysRecord = isRecord(value.days) ? value.days : {};

  DAY_INDEXES.forEach((dayIndex) => {
    session.days[dayIndex] = normalizeHatchDayState(daysRecord[String(dayIndex)], getDayDate(startDate, dayIndex), dayIndex);
  });

  session.sessionId = typeof value.sessionId === "string" && value.sessionId ? value.sessionId : session.sessionId;
  session.currentDay = getCurrentDay(startDate);
  return session;
}

function buildCurrentWeekItems(session: HatchSession): (MusicItem | null)[] {
  return COLLECTION_ITEM_PARTS.map((part) => {
    for (const dayIndex of DAY_INDEXES) {
      const match = session.days[dayIndex].items.find((item) => item.part === part);
      if (match) return match;
    }
    return null;
  });
}

function buildDailyHistory(session: HatchSession): MusicItem[] {
  return DAY_INDEXES.flatMap((dayIndex) => session.days[dayIndex].items)
    .filter(Boolean)
    .sort((a, b) => {
      const dateDiff = (a.sourceDate || "").localeCompare(b.sourceDate || "");
      if (dateDiff !== 0) return dateDiff;
      return a.part.localeCompare(b.part);
    });
}

function hydrateState(base: Omit<AppState, "currentMockDay" | "currentWeekItems" | "dailyHistory">): AppState {
  const normalizedSession = normalizeHatchSession(base.hatchSession);
  return {
    ...base,
    hatchSession: normalizedSession,
    currentMockDay: normalizedSession.currentDay,
    currentWeekItems: buildCurrentWeekItems(normalizedSession),
    dailyHistory: buildDailyHistory(normalizedSession),
  };
}

function normalizePet(value: unknown): Pet | null {
  if (!isRecord(value)) return null;

  const mainGenre = normalizeGenre(value.mainGenre ?? value.baseGenre);
  const items = (Array.isArray(value.items) ? value.items : [])
    .map((item) => normalizeMusicItem(item, 1))
    .filter((item): item is MusicItem => Boolean(item));
  const fallbackSubGenre = items[1]?.genre || items[0]?.genre || mainGenre;
  const rawBaseType = value.baseType;
  const baseType = rawBaseType === "O" || rawBaseType === "G" || rawBaseType === "B" ? rawBaseType : getBaseType(mainGenre);

  return {
    id: typeof value.id === "string" && value.id ? value.id : generateId(),
    name: typeof value.name === "string" && value.name ? value.name : `${mainGenre} 音樂精靈`,
    mainGenre,
    subGenre: normalizeGenre(value.subGenre ?? fallbackSubGenre),
    baseType,
    items,
    description: typeof value.description === "string" && value.description ? value.description : `由本週的音樂行程誕生，充滿 ${mainGenre} 的氣息。`,
    weekNumber: Math.max(Number(value.weekNumber) || 1, 1),
  };
}

function normalizeMapEntry(value: unknown): MapEntry | null {
  if (!isRecord(value)) return null;

  const fallbackPetInput = isRecord(value.pet)
    ? value.pet
    : {
        id: value.petId,
        name: value.petName,
        mainGenre: value.mainGenre,
        subGenre: value.secondGenre,
        items: value.items,
        description: typeof value.description === "string" ? value.description : undefined,
        weekNumber: 1,
      };

  const pet = normalizePet(fallbackPetInput);
  if (!pet) return null;

  const petName = typeof value.petName === "string" && value.petName ? value.petName : pet.name;
  const mainGenre = normalizeGenre(value.mainGenre ?? pet.mainGenre);
  const secondGenre = normalizeGenre(value.secondGenre ?? pet.subGenre);
  const items = (Array.isArray(value.items) ? value.items : pet.items)
    .map((item) => normalizeMusicItem(item, 1))
    .filter((item): item is MusicItem => Boolean(item));
  const provider = typeof value.provider === "string" && value.provider ? value.provider : null;
  const petImage = typeof value.petImage === "string" && value.petImage ? value.petImage : null;

  return {
    id: typeof value.id === "string" && value.id ? value.id : generateId(),
    petId: typeof value.petId === "string" && value.petId ? value.petId : pet.id,
    ownerName: typeof value.ownerName === "string" && value.ownerName ? value.ownerName : "Anonymous",
    country: typeof value.country === "string" && value.country ? value.country : "Taiwan",
    city: typeof value.city === "string" && value.city ? value.city : "Taipei",
    top: Number.isFinite(Number(value.top)) ? Number(value.top) : 50,
    left: Number.isFinite(Number(value.left)) ? Number(value.left) : 50,
    pet: {
      ...pet,
      name: petName,
      mainGenre,
      subGenre: secondGenre,
      items,
    },
    petImage,
    petName,
    mainGenre,
    secondGenre,
    items,
    provider,
    sourceDay: clampDayIndex(value.sourceDay ?? items[0]?.sourceDay ?? 1),
    sourceDate: typeof value.sourceDate === "string" ? value.sourceDate : items[0]?.sourceDate || "",
  };
}

function buildLegacySession(parsed: Record<string, unknown>): HatchSession {
  const legacyDay = clampDayIndex(parsed.currentMockDay ?? parsed.currentDay ?? 1);
  const startDate = addDaysToDateKey(toLocalDateKey(new Date()), -(legacyDay - 1));
  const session = createNewHatchSession(startDate);

  if (Array.isArray(parsed.currentWeekItems)) {
    parsed.currentWeekItems.forEach((item, index) => {
      const normalizedItem = normalizeMusicItem(item, clampDayIndex(Math.floor(index / 2) + 1), getDayDate(startDate, clampDayIndex(Math.floor(index / 2) + 1)));
      if (!normalizedItem) return;
      const targetDay = clampDayIndex(normalizedItem.sourceDay ?? normalizedItem.day);
      session.days[targetDay].items = session.days[targetDay].items
        .filter((existing) => existing.part !== normalizedItem.part)
        .concat([{ ...normalizedItem, sourceDay: targetDay, sourceDate: session.days[targetDay].date, day: targetDay }]);
    });
  }

  if (Array.isArray(parsed.dailyHistory)) {
    parsed.dailyHistory.forEach((item) => {
      const normalizedItem = normalizeMusicItem(item, 1, session.days[1].date);
      if (!normalizedItem) return;
      const targetDay = clampDayIndex(normalizedItem.sourceDay ?? normalizedItem.day);
      const existing = session.days[targetDay].items.some((entry) => entry.id === normalizedItem.id || entry.part === normalizedItem.part);
      if (!existing) {
        session.days[targetDay].items.push({ ...normalizedItem, sourceDay: targetDay, sourceDate: session.days[targetDay].date, day: targetDay });
      }
    });
  }

  const legacyTracks = Array.isArray(parsed.tracks)
    ? parsed.tracks.map((track) => normalizeTrackRecord(track)).filter((track): track is TrackRecord => Boolean(track))
    : [];
  if (legacyTracks.length > 0) {
    session.days[1].tracks = dedupeTracks(legacyTracks);
    session.days[1].completed = session.days[1].completed || session.days[1].tracks.length > 0;
  }

  DAY_INDEXES.forEach((dayIndex) => {
    session.days[dayIndex].completed = getDaySlotConfigs(dayIndex).every((slot) =>
      session.days[dayIndex].items.some((item) => item.part === slot.part)
    );
  });
  session.currentDay = getCurrentDay(startDate);
  return session;
}

function getDefaultState(): AppState {
  return hydrateState({
    userProfile: null,
    hatchSession: createNewHatchSession(),
    currentBaseKey: getRandomBaseKey(),
    weeklyPets: [],
    mapEntries: [],
  });
}

function loadStoredState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultState();

    const parsed = JSON.parse(stored);
    if (!isRecord(parsed)) return getDefaultState();

    const safeMapEntries = (Array.isArray(parsed.mapEntries) ? parsed.mapEntries : [])
      .map(normalizeMapEntry)
      .filter((entry): entry is MapEntry => Boolean(entry))
      .filter((entry) => !MOCK_MAP_ENTRIES.some((mockEntry) => mockEntry.id === entry.id));

    const baseState = {
      userProfile: isRecord(parsed.userProfile)
        ? {
            name: typeof parsed.userProfile.name === "string" ? parsed.userProfile.name : "",
            email: typeof parsed.userProfile.email === "string" ? parsed.userProfile.email : "",
            country: typeof parsed.userProfile.country === "string" && parsed.userProfile.country ? parsed.userProfile.country : "Taiwan",
            city: typeof parsed.userProfile.city === "string" && parsed.userProfile.city ? parsed.userProfile.city : "Taipei",
            style: typeof parsed.userProfile.style === "string" ? parsed.userProfile.style : undefined,
            musicProvider: (typeof parsed.userProfile.musicProvider === "string" ? parsed.userProfile.musicProvider : "mock") as MusicProvider,
            lastfmUsername: typeof parsed.userProfile.lastfmUsername === "string" ? parsed.userProfile.lastfmUsername : undefined,
            agreed: Boolean(parsed.userProfile.agreed),
          }
        : null,
      hatchSession: parsed.hatchSession ? normalizeHatchSession(parsed.hatchSession) : buildLegacySession(parsed),
      currentBaseKey: normalizeBaseKey(parsed.currentBaseKey ?? getRandomBaseKey()),
      weeklyPets: (Array.isArray(parsed.weeklyPets) ? parsed.weeklyPets : [])
        .map(normalizePet)
        .filter((pet): pet is Pet => Boolean(pet)),
      mapEntries: safeMapEntries,
    };

    return hydrateState(baseState);
  } catch (error) {
    console.error("Failed to load state", error);
    return getDefaultState();
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(loadStoredState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (profile: UserProfile) => {
    setState((previous) =>
      hydrateState({
        ...previous,
        userProfile: {
          ...profile,
          musicProvider: profile.musicProvider || "mock",
          lastfmUsername: profile.lastfmUsername?.trim() || undefined,
        },
        hatchSession: previous.hatchSession || createNewHatchSession(),
      })
    );
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setState((previous) => {
      if (!previous.userProfile) return previous;
      return hydrateState({
        ...previous,
        userProfile: {
          ...previous.userProfile,
          ...updates,
          musicProvider: (updates.musicProvider || previous.userProfile.musicProvider || "mock") as MusicProvider,
          lastfmUsername:
            updates.lastfmUsername !== undefined
              ? updates.lastfmUsername.trim() || undefined
              : previous.userProfile.lastfmUsername,
        },
      });
    });
  };

  const generateItem = (item: MusicItem) => {
    setState((previous) => {
      const session = normalizeHatchSession(previous.hatchSession);
      const currentDay = clampDayIndex(session.currentDay);
      const sourceDate = session.days[currentDay].date;
      const normalizedItem = normalizeMusicItem(item, currentDay, sourceDate);
      if (!normalizedItem) return previous;

      const dayItems = session.days[currentDay].items.filter((existing) => existing.part !== normalizedItem.part);
      dayItems.push({
        ...normalizedItem,
        day: currentDay,
        sourceDay: currentDay,
        sourceDate,
      });
      session.days[currentDay].items = dayItems;
      session.days[currentDay].completed = getDaySlotConfigs(currentDay).every((slot) => dayItems.some((entry) => entry.part === slot.part));

      return hydrateState({
        ...previous,
        hatchSession: session,
      });
    });
  };

  const saveTracksForCurrentDay = (tracks: TrackRecord[], analysis?: DailyMusicData | null) => {
    setState((previous) => {
      const session = normalizeHatchSession(previous.hatchSession);
      const currentDay = clampDayIndex(session.currentDay);
      const currentTracks = session.days[currentDay].tracks;
      session.days[currentDay].tracks = dedupeTracks([...currentTracks, ...tracks.map((track) => ({
        ...track,
        provider: (track.provider || previous.userProfile?.musicProvider || "mock") as MusicProvider,
      }))]);
      if (analysis !== undefined) {
        session.days[currentDay].analysis = analysis;
      }
      return hydrateState({
        ...previous,
        hatchSession: session,
      });
    });
  };

  const setCurrentDayAnalysis = (analysis: DailyMusicData | null) => {
    setState((previous) => {
      const session = normalizeHatchSession(previous.hatchSession);
      const currentDay = clampDayIndex(session.currentDay);
      session.days[currentDay].analysis = analysis;
      return hydrateState({
        ...previous,
        hatchSession: session,
      });
    });
  };

  const getTracksForDay = (dayIndex: number) => {
    const targetDay = clampDayIndex(dayIndex);
    return state.hatchSession.days[targetDay].tracks;
  };

  const getFinalPetInput = (): FinalPetInput => {
    const session = normalizeHatchSession(state.hatchSession);
    return {
      sessionId: session.sessionId,
      startDate: session.startDate,
      currentDay: session.currentDay,
      days: {
        1: session.days[1],
        2: session.days[2],
        3: session.days[3],
      },
      finalTracks: dedupeTracks(DAY_INDEXES.flatMap((dayIndex) => session.days[dayIndex].tracks)),
    };
  };

  const advanceDay = () => {
    setState((previous) => {
      const session = normalizeHatchSession(previous.hatchSession);
      if (session.currentDay >= TOTAL_DAYS) return previous;
      const nextStartDate = addDaysToDateKey(session.startDate, -1);
      const nextSession = normalizeHatchSession({
        ...session,
        startDate: nextStartDate,
      });
      return hydrateState({
        ...previous,
        hatchSession: nextSession,
      });
    });
  };

  const generateWeeklyPet = (pet: Pet) => {
    setState((previous) => {
      const safePet = normalizePet(pet);
      if (!safePet) return previous;
      return hydrateState({
        ...previous,
        weeklyPets: [...(Array.isArray(previous.weeklyPets) ? previous.weeklyPets : []), safePet],
      });
    });
  };

  const resetWeek = () => {
    setState((previous) =>
      hydrateState({
        ...previous,
        hatchSession: createNewHatchSession(),
        currentBaseKey: getRandomBaseKey(),
      })
    );
  };

  const autoFillWeek = async () => {
    const { getTodayMusicData } = await import("./mockData");
    const provider = (state.userProfile?.musicProvider || "mock") as MusicProvider;
    const lastfmUsername = state.userProfile?.lastfmUsername;
    const startDate = addDaysToDateKey(toLocalDateKey(new Date()), -(TOTAL_DAYS - 1));
    const session = createNewHatchSession(startDate);

    for (const dayIndex of DAY_INDEXES) {
      const dayStart = session.days[dayIndex].date;
      const dayEnd = addDaysToDateKey(dayStart, 1);
      const payload = await getTodayMusicData(provider, {
        lastfmUsername,
        dayStart,
        dayEnd,
        dayIndex,
      });

      session.days[dayIndex].analysis = payload.data;
      session.days[dayIndex].tracks = dedupeTracks(payload.tracks);

      const mainGenre = normalizeGenre(payload.data.assetGenre || payload.data.mainGenre);
      const secondaryGenre = normalizeGenre(payload.data.subGenre || mainGenre);
      const items: MusicItem[] = [];

      getDaySlotConfigs(dayIndex).forEach((slot, slotIndex) => {
        const itemGenre = slot.genreSource === "main" ? mainGenre : secondaryGenre;
        items.push({
          id: `${dayIndex}-${slot.part}-${slotIndex}-${Math.random().toString(36).slice(2)}`,
          day: dayIndex,
          sourceDay: dayIndex,
          sourceDate: dayStart,
          part: slot.part,
          genre: itemGenre,
          label: `${itemGenre} ${slot.part}`,
          icon: "",
          imageSrc: resolveAssetImage(itemGenre, slot.part, `${itemGenre}-${slot.part}-${dayIndex}`),
        });
      });

      session.days[dayIndex].items = items;
      session.days[dayIndex].completed = true;
    }

    setState((previous) =>
      hydrateState({
        ...previous,
        hatchSession: session,
      })
    );
  };

  const addToMap = (entry: MapEntry) => {
    setState((previous) => {
      const safeEntry = normalizeMapEntry(entry);
      if (!safeEntry) return previous;
      return hydrateState({
        ...previous,
        mapEntries: [...(Array.isArray(previous.mapEntries) ? previous.mapEntries : []), safeEntry],
      });
    });
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        updateUserProfile,
        generateItem,
        advanceDay,
        generateWeeklyPet,
        resetWeek,
        addToMap,
        autoFillWeek,
        saveTracksForCurrentDay,
        setCurrentDayAnalysis,
        getTracksForDay,
        getFinalPetInput,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
