import dotenv from "dotenv";
import { buildDailyMusicData } from "../_lib/music-analysis.js";
import { ApiRequest, ApiResponse, getRequestUrl, jsonResponse } from "../_lib/http.js";
import { getValidSpotifyAccessToken, spotifyApiFetch } from "../_lib/spotify.js";
import type { DailyMusicData, DailyMusicPayload, LastFmTrackDebugItem, MusicFetchDebug, TrackRecord } from "../../src/types";

dotenv.config({ path: ".env.local" });
dotenv.config();

type MusicProvider = "mock" | "spotify" | "lastfm";

type SpotifyRecentTracksResponse = {
  items?: Array<{
    played_at?: string;
    track?: {
      id?: string;
      name?: string;
      artists?: Array<{ id?: string; name?: string }>;
    };
  }>;
};

type SpotifyTopArtistsResponse = {
  items?: Array<{
    id?: string;
    name?: string;
    genres?: string[];
  }>;
};

type SpotifyArtistsResponse = {
  artists?: Array<{
    id?: string;
    genres?: string[];
  }>;
};

type LastFmRecentTracksResponse = {
  recenttracks?: {
    track?: Array<{
      name?: string;
      artist?: { "#text"?: string };
      album?: { "#text"?: string };
      date?: { uts?: string; "#text"?: string };
      "@attr"?: { nowplaying?: string };
      url?: string;
    }>;
  };
};

type LastFmArtistTopTagsResponse = {
  toptags?: {
    tag?: Array<{ name?: string }>;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text().catch(() => "");
  return text.trim() ? (JSON.parse(text) as T) : ({} as T);
}

function getDayWindow(req: ApiRequest) {
  const url = getRequestUrl(req);
  const dayStartRaw = (url.searchParams.get("dayStart") || "").trim();
  const dayEndRaw = (url.searchParams.get("dayEnd") || "").trim();
  const dayIndex = Number(url.searchParams.get("dayIndex") || "1");
  return {
    dayStartRaw,
    dayEndRaw,
    dayStart: dayStartRaw ? new Date(dayStartRaw) : null,
    dayEnd: dayEndRaw ? new Date(dayEndRaw) : null,
    dayIndex,
  };
}

function formatDateDebug(date: Date | null) {
  return date ? date.toISOString() : null;
}

function formatDateLocalDebug(date: Date | null) {
  return date ? date.toLocaleString("zh-TW", { hour12: false }) : null;
}

function buildLastFmRequestUrl(params: Record<string, string>) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("api_key", "REDACTED");
  url.searchParams.set("format", "json");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function toLastFmTrackDebugItems(
  tracks: Array<{
    name?: string;
    artist?: { "#text"?: string };
    album?: { "#text"?: string };
    date?: { uts?: string; "#text"?: string };
    "@attr"?: { nowplaying?: string };
    url?: string;
  }>
): LastFmTrackDebugItem[] {
  return tracks.slice(0, 5).map((track) => ({
    name: track.name || "",
    artist: track.artist?.["#text"] || "",
    album: track.album?.["#text"] || "",
    dateUts: track.date?.uts || null,
    dateText: track.date?.["#text"] || null,
    nowplaying: track["@attr"]?.nowplaying === "true",
    url: track.url || "",
  }));
}

function isNowPlayingWithinWindow(track: { "@attr"?: { nowplaying?: string } }, dayStart: Date | null, dayEnd: Date | null) {
  if (track["@attr"]?.nowplaying !== "true") return false;
  if (!dayStart || !dayEnd) return true;
  const now = Date.now();
  return now >= dayStart.getTime() && now < dayEnd.getTime();
}

function isWithinDayRange(playedAt: string | undefined, dayStart: Date | null, dayEnd: Date | null) {
  if (!playedAt || !dayStart || !dayEnd) return true;
  const playedTime = new Date(playedAt).getTime();
  return playedTime >= dayStart.getTime() && playedTime < dayEnd.getTime();
}

function getProvider(req: ApiRequest): MusicProvider {
  const url = getRequestUrl(req);
  const provider = (url.searchParams.get("provider") || "mock").toLowerCase();
  if (provider === "spotify" || provider === "lastfm" || provider === "mock") {
    return provider;
  }
  return "mock";
}

function buildSpotifyQuote(trackNames: string[], dayIndex?: number) {
  if (trackNames.length === 0) {
    return `第 ${dayIndex || 1} 天目前還沒有同步到新的 Spotify 播放紀錄。`;
  }
  return `第 ${dayIndex || 1} 天的 Spotify 旅程從「${trackNames[0]}」一路延伸到 ${trackNames.length} 首歌。`;
}

async function getSpotifyDailyMusicData(req: ApiRequest, res: ApiResponse): Promise<DailyMusicPayload> {
  const accessToken = await getValidSpotifyAccessToken(req, res);
  if (!accessToken) {
    throw Object.assign(new Error("請先連接 Spotify 帳號。"), { statusCode: 401, code: "SPOTIFY_NOT_CONNECTED" });
  }

  const { dayStart, dayEnd, dayIndex } = getDayWindow(req);

  const [recentlyPlayed, topArtists] = await Promise.all([
    spotifyApiFetch<SpotifyRecentTracksResponse>(accessToken, "/me/player/recently-played", { limit: "50" }),
    spotifyApiFetch<SpotifyTopArtistsResponse>(accessToken, "/me/top/artists", { limit: "10", time_range: "short_term" }),
  ]);

  const recentTracks = (recentlyPlayed.items || []).filter((item) => isWithinDayRange(item.played_at, dayStart, dayEnd));
  const tracks: TrackRecord[] = recentTracks.map((item, index) => ({
    id: item.track?.id || `${item.played_at || "spotify"}-${index}`,
    title: item.track?.name || `Spotify Track ${index + 1}`,
    artist: (item.track?.artists || []).map((artist) => artist.name).filter(Boolean).join(", ") || "Unknown Artist",
    playedAt: item.played_at || new Date().toISOString(),
    provider: "spotify",
  }));

  const artistIds = Array.from(
    new Set(
      recentTracks
        .flatMap((item) => item.track?.artists || [])
        .map((artist) => artist.id)
        .filter((artistId): artistId is string => typeof artistId === "string" && artistId.length > 0)
    )
  );

  let artistGenres: string[] = [];
  if (artistIds.length > 0) {
    const artistGroups = [];
    for (let index = 0; index < artistIds.length; index += 50) {
      artistGroups.push(artistIds.slice(index, index + 50));
    }

    const artistResponses = await Promise.all(
      artistGroups.map((ids) => spotifyApiFetch<SpotifyArtistsResponse>(accessToken, "/artists", { ids: ids.join(",") }))
    );

    artistGenres = artistResponses.flatMap((response) => (response.artists || []).flatMap((artist) => artist.genres || []));
  }

  if (artistGenres.length === 0 && recentTracks.length > 0) {
    artistGenres = (topArtists.items || []).flatMap((artist) => artist.genres || []);
  }

  const trackNames = recentTracks.map((item) => item.track?.name).filter((name): name is string => typeof name === "string" && name.length > 0);
  const data = buildDailyMusicData({
    songCount: Math.max(trackNames.length, recentTracks.length, 0),
    rawGenres: artistGenres,
    quote: buildSpotifyQuote(trackNames, dayIndex),
  });
  console.info("[music/today][spotify]", {
    dayIndex,
    dayStart: formatDateDebug(dayStart),
    dayEnd: formatDateDebug(dayEnd),
    trackCount: tracks.length,
  });
  return { data, tracks };
}

function getLastFmApiKey() {
  return process.env.LASTFM_API_KEY || "";
}

async function lastFmFetch<T>(params: Record<string, string>) {
  const apiKey = getLastFmApiKey();
  if (!apiKey) {
    throw Object.assign(new Error("Last.fm 尚未設定完成，請先加入 LASTFM_API_KEY。"), { statusCode: 500, code: "LASTFM_API_KEY_MISSING" });
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url);
  const body = await readJson<T & { message?: string; error?: number }>(response);
  if (!response.ok || body?.error) {
    throw Object.assign(new Error(body?.message || "Last.fm API 請求失敗。"), {
      statusCode: response.status || 502,
      code: "LASTFM_API_ERROR",
      details: body,
    });
  }

  return body as T;
}

function buildLastFmQuote(username: string, artists: string[], dayIndex?: number) {
  if (artists.length === 0) {
    return `${username} 的 Last.fm 第 ${dayIndex || 1} 天目前還沒有同步到新的播放紀錄。`;
  }
  return `${username} 第 ${dayIndex || 1} 天最近常聽的聲音來自 ${artists[0]} 等 ${artists.length} 組藝術家。`;
}

async function getLastFmDailyMusicData(req: ApiRequest): Promise<DailyMusicPayload> {
  const url = getRequestUrl(req);
  const username = (url.searchParams.get("lastfmUsername") || "").trim();
  if (!username) {
    throw Object.assign(new Error("請先輸入 Last.fm 使用者名稱。"), { statusCode: 400, code: "LASTFM_USERNAME_REQUIRED" });
  }

  const { dayStart, dayEnd, dayIndex } = getDayWindow(req);
  const debugRecentOnly = url.searchParams.get("debugRecentOnly") === "true" || url.searchParams.get("debugRecentOnly") === "1";
  const startDate = (url.searchParams.get("startDate") || "").trim();
  const localToday = new Date().toLocaleDateString("sv-SE");
  const timezoneOffset = new Date().getTimezoneOffset();
  const fromUnix = dayStart ? Math.floor(dayStart.getTime() / 1000) : null;
  const toUnix = dayEnd ? Math.floor(dayEnd.getTime() / 1000) : null;

  const dayRangeParams: Record<string, string> = {
    method: "user.getRecentTracks",
    user: username,
    limit: "50",
  };
  if (fromUnix !== null) dayRangeParams.from = String(fromUnix);
  if (toUnix !== null) dayRangeParams.to = String(toUnix);

  const recentParams: Record<string, string> = {
    method: "user.getRecentTracks",
    user: username,
    limit: "10",
  };

  let dayRangeResponse: LastFmRecentTracksResponse | null = null;
  let recentResponse: LastFmRecentTracksResponse | null = null;
  let apiErrorMessage: string | null = null;
  let filteredOutReason: string | null = null;

  try {
    if (!debugRecentOnly) {
      dayRangeResponse = await lastFmFetch<LastFmRecentTracksResponse>(dayRangeParams);
    }
    recentResponse = await lastFmFetch<LastFmRecentTracksResponse>(recentParams);
  } catch (error) {
    apiErrorMessage = error instanceof Error ? error.message : "Last.fm API 請求失敗。";
    throw Object.assign(error instanceof Error ? error : new Error(apiErrorMessage), {
      debug: {
        source: "lastfm",
        username,
        currentDay: dayIndex,
        startDate,
        localToday,
        timezoneOffset,
        dayStartLocalString: formatDateLocalDebug(dayStart),
        dayEndLocalString: formatDateLocalDebug(dayEnd),
        dayStartISO: formatDateDebug(dayStart),
        dayEndISO: formatDateDebug(dayEnd),
        fromUnix,
        toUnix,
        requestUrlWithoutApiKey: debugRecentOnly ? buildLastFmRequestUrl(recentParams) : buildLastFmRequestUrl(dayRangeParams),
        dayRangeRequestUrlWithoutApiKey: buildLastFmRequestUrl(dayRangeParams),
        recentRequestUrlWithoutApiKey: buildLastFmRequestUrl(recentParams),
        rawTrackCount: 0,
        parsedTrackCount: 0,
        dayRangeRawCount: 0,
        dayRangeParsedCount: 0,
        recentRawCount: 0,
        rawFirstTracks: [],
        recentFirstTracks: [],
        filteredOutReason: null,
        error: apiErrorMessage,
      } satisfies MusicFetchDebug,
    });
  }

  const dayRangeTracks = dayRangeResponse?.recenttracks?.track || [];
  const recentTracks = recentResponse?.recenttracks?.track || [];
  const sourceTracks = debugRecentOnly ? recentTracks : dayRangeTracks;

  const tracks = sourceTracks.filter((track) => {
    if (track.date?.uts) return true;
    return isNowPlayingWithinWindow(track, dayStart, dayEnd);
  });
  const artistNames = Array.from(
    new Set(
      tracks
        .map((track) => track.artist?.["#text"])
        .filter((name): name is string => typeof name === "string" && name.length > 0)
    )
  ).slice(0, 5);

  const tagResponses = await Promise.all(
    artistNames.map((artist) =>
      lastFmFetch<LastFmArtistTopTagsResponse>({
        method: "artist.getTopTags",
        artist,
        autocorrect: "1",
      }).catch(() => ({ toptags: { tag: [] } }))
    )
  );

  const rawGenres = tagResponses.flatMap((response) => (response.toptags?.tag || []).slice(0, 4).map((tag) => tag.name || "")).filter(Boolean);
  const normalizedTracks: TrackRecord[] = tracks.map((track, index) => ({
    id: `${username}-${track.date?.uts || "lastfm"}-${index}`,
    title: track.name || `Last.fm Track ${index + 1}`,
    artist: track.artist?.["#text"] || "Unknown Artist",
    playedAt: track.date?.uts ? new Date(Number(track.date.uts) * 1000).toISOString() : new Date().toISOString(),
    provider: "lastfm",
  }));

  if (!debugRecentOnly) {
    if (dayRangeTracks.length === 0 && recentTracks.length > 0) {
      filteredOutReason = "Last.fm 最近有歌，但 current hatch day 的 from/to 範圍內沒有任何 scrobble。";
    } else if (dayRangeTracks.length > 0 && normalizedTracks.length === 0) {
      filteredOutReason = "Last.fm day range 有回傳 track，但都沒有可用的 date.uts；只有 nowplaying 或資料不完整。";
    } else if (dayRangeTracks.length === 0 && recentTracks.length === 0) {
      filteredOutReason = "Last.fm 最近 10 首與 day range 都沒有任何資料。";
    }
  } else if (recentTracks.length === 0) {
    filteredOutReason = "Last.fm 最近 10 首沒有回傳任何資料。";
  }

  const data = buildDailyMusicData({
    songCount: Math.max(normalizedTracks.length, 0),
    rawGenres,
    quote:
      normalizedTracks.length > 0
        ? buildLastFmQuote(username, artistNames, dayIndex)
        : debugRecentOnly
          ? `${username} 的 Last.fm 最近 10 首目前沒有可顯示的歌曲。`
          : `${username} 的 Last.fm 第 ${dayIndex || 1} 天目前沒有同步到當日歌曲。`,
  });
  const debug: MusicFetchDebug = {
    source: "lastfm",
    username,
    currentDay: dayIndex,
    startDate,
    localToday,
    timezoneOffset,
    dayStartLocalString: formatDateLocalDebug(dayStart),
    dayEndLocalString: formatDateLocalDebug(dayEnd),
    dayStartISO: formatDateDebug(dayStart),
    dayEndISO: formatDateDebug(dayEnd),
    fromUnix,
    toUnix,
    requestUrlWithoutApiKey: debugRecentOnly ? buildLastFmRequestUrl(recentParams) : buildLastFmRequestUrl(dayRangeParams),
    dayRangeRequestUrlWithoutApiKey: buildLastFmRequestUrl(dayRangeParams),
    recentRequestUrlWithoutApiKey: buildLastFmRequestUrl(recentParams),
    rawTrackCount: sourceTracks.length,
    parsedTrackCount: normalizedTracks.length,
    dayRangeRawCount: dayRangeTracks.length,
    dayRangeParsedCount: debugRecentOnly ? 0 : normalizedTracks.length,
    recentRawCount: recentTracks.length,
    rawFirstTracks: toLastFmTrackDebugItems(dayRangeTracks),
    recentFirstTracks: toLastFmTrackDebugItems(recentTracks),
    filteredOutReason,
    error: apiErrorMessage,
  };
  console.info("[music/today][lastfm]", {
    username,
    dayIndex,
    dayStart: formatDateDebug(dayStart),
    dayEnd: formatDateDebug(dayEnd),
    fromUnix,
    toUnix,
    dayRangeRawCount: dayRangeTracks.length,
    recentRawCount: recentTracks.length,
    parsedTrackCount: normalizedTracks.length,
    filteredOutReason,
  });
  return { data, tracks: normalizedTracks, debug };
}

async function getMockDailyMusicData(req: ApiRequest): Promise<DailyMusicPayload> {
  const { getTodayMusicData } = await import("../../src/mockData");
  const { dayStartRaw, dayEndRaw, dayIndex } = getDayWindow(req);
  return getTodayMusicData("mock", { dayStart: dayStartRaw, dayEnd: dayEndRaw, dayIndex });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return jsonResponse(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const provider = getProvider(req);
    const payload =
      provider === "spotify"
        ? await getSpotifyDailyMusicData(req, res)
        : provider === "lastfm"
          ? await getLastFmDailyMusicData(req)
          : await getMockDailyMusicData(req);

    return jsonResponse(res, 200, { ok: true, provider, data: payload.data, tracks: payload.tracks, debug: payload.debug || null });
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number" ? Number((error as { statusCode: number }).statusCode) : 500;
    const code = typeof (error as { code?: unknown })?.code === "string" ? String((error as { code: string }).code) : null;
    const message = error instanceof Error ? error.message : "音樂資料讀取失敗。";
    const debug = isRecord(error) && "debug" in error ? (error as { debug?: unknown }).debug : null;
    return jsonResponse(res, statusCode, { ok: false, error: message, code, debug });
  }
}
