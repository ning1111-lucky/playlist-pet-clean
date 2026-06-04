export type Genre = "Pop" | "Hip-hop" | "Hiphop" | "K-pop" | "Kpop" | "EDM" | "Classical" | "Jazz" | "R&B" | "RnB" | "Country" | "Rock" | "Taiwan Indie" | "Indie" | "Mixed" | "Hidden";
export type MusicProvider = "mock" | "spotify" | "lastfm";

export type ItemPart = "clothes" | "headwear" | "accessory" | "handheld" | "shoes" | "enhance" | "final weekly pet";

export interface UserProfile {
  name: string;
  email: string;
  country: string;
  city: string;
  style?: string;
  musicProvider?: MusicProvider;
  lastfmUsername?: string;
  agreed: boolean;
}

export interface MusicItem {
  id: string; // Unique ID for this generated item
  day: number;
  part: ItemPart;
  genre: Genre;
  label: string;
  icon: string; // Emoji or identifier for CSS placeholder
  imageSrc?: string | null;
  sourceDay?: number;
  sourceDate?: string;
}

export interface TrackRecord {
  id: string;
  title: string;
  artist: string;
  playedAt: string;
  provider: MusicProvider;
}

export interface LastFmTrackDebugItem {
  name: string;
  artist: string;
  album: string;
  dateUts: string | null;
  dateText: string | null;
  nowplaying: boolean;
  url: string;
}

export interface MusicFetchDebug {
  source: MusicProvider;
  username?: string;
  currentDay?: number;
  startDate?: string;
  localToday?: string;
  timezoneOffset?: number;
  dayStartLocalString?: string | null;
  dayEndLocalString?: string | null;
  dayStartISO?: string | null;
  dayEndISO?: string | null;
  fromUnix?: number | null;
  toUnix?: number | null;
  requestUrlWithoutApiKey?: string | null;
  dayRangeRequestUrlWithoutApiKey?: string | null;
  recentRequestUrlWithoutApiKey?: string | null;
  dayRangeRawCount?: number;
  rawTrackCount?: number;
  parsedTrackCount?: number;
  dayRangeParsedCount?: number;
  recentRawCount?: number;
  rawFirstTracks?: LastFmTrackDebugItem[];
  recentFirstTracks?: LastFmTrackDebugItem[];
  filteredOutReason?: string | null;
  error?: string | null;
}

export interface Pet {
  id: string;
  name: string;
  mainGenre: Genre;
  subGenre: Genre;
  baseType: "O" | "G" | "B";
  items: MusicItem[];
  description: string;
  weekNumber: number;
}

export interface MapEntry {
  id: string;
  petId: string;
  ownerName: string;
  country: string;
  city: string;
  top: number;
  left: number;
  pet: Pet;
  petImage?: string | null;
  petName?: string;
  mainGenre?: Genre;
  secondGenre?: Genre;
  items?: MusicItem[];
  provider?: string | null;
  sourceDay?: number;
  sourceDate?: string;
}

export interface DailyMusicData {
  songCount: number;
  mainGenre: Genre;
  subGenre: Genre;
  assetGenre?: Genre;
  distribution: { genre: Genre; percentage: number }[];
  quote: string;
}

export interface HatchDayState {
  date: string;
  tracks: TrackRecord[];
  analysis: DailyMusicData | null;
  items: MusicItem[];
  completed: boolean;
}

export interface HatchSession {
  sessionId: string;
  startDate: string;
  currentDay: number;
  days: {
    1: HatchDayState;
    2: HatchDayState;
    3: HatchDayState;
  };
}

export interface DailyMusicPayload {
  data: DailyMusicData;
  tracks: TrackRecord[];
  debug?: MusicFetchDebug | null;
}

export interface GeminiAssetAnalysis {
  base_description: string;
  clothes_description: string;
  shoes_description: string;
  headwear_description: string;
  handheld_description: string;
  accessory_description: string;
  style_summary: string;
  final_prompt_en: string;
  negative_prompt_en: string;
}
