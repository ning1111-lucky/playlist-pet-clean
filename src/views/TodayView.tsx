import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { Button, PixelBadge, PixelIcon, PixelItemCard, PixelLogoTitle, PixelProgress, PixelStatusBar, RetroWindow } from "../components/UI";
import { getBaseType, getCollectionSlotIndex, getDaySlotConfigs, getTodayMusicData, TOTAL_DAYS } from "../mockData";
import { DailyMusicData, MusicItem, Genre, MapEntry, Pet, GeminiAssetAnalysis, MusicFetchDebug } from "../types";
import { generateId } from "../utils";
import { motion } from "motion/react";
import { baseShapeMap, resolveAssetImage } from "../assetMap";
import { getDayDate } from "../AppContext";

const GENERATED_WEEKLY_PET_IMAGE_KEY = "generatedWeeklyPetImage";

export function normalizeGenre(genre: string): string {
  const map: Record<string, string> = {
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
    "Taiwan Indie": "Indie",
    INDIE: "Indie",
    indie: "Indie",
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
  };

  return map[genre] || genre;
}

function getStoredGeneratedImage(): string | null {
  try {
    return localStorage.getItem(GENERATED_WEEKLY_PET_IMAGE_KEY);
  } catch {
    return null;
  }
}

async function readApiJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const rawText = await response.text().catch(() => "");
  const fallbackError = "生成失敗，請重試";

  if (!rawText.trim()) {
    return {
      ok: false,
      error: fallbackError,
    };
  }

  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    if (!response.ok) {
      return {
        ok: false,
        error: rawText.trim() || fallbackError,
      };
    }
  }

  return {
    ok: false,
    error: response.ok ? fallbackError : rawText.trim() || fallbackError,
  };
}

async function appendImageAssetToFormData(formData: FormData, fieldName: string, source: string) {
  try {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${fieldName}`);
    }

    const blob = await response.blob();
    const cleanPath = source.split("?")[0];
    const extension = cleanPath.includes(".") ? cleanPath.split(".").pop() || "png" : "png";
    const mimeType = blob.type || (extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png");
    const file = new File([blob], `${fieldName}.${extension}`, { type: mimeType });
    formData.append(fieldName, file);
  } catch {
    formData.append(fieldName, source);
  }
}

function extractAssetKeyFromPath(value: string | null | undefined): string {
  if (!value) return "";
  const cleanPath = value.split("?")[0] || "";
  const filename = cleanPath.split("/").pop() || "";
  return filename.replace(/\.[a-z0-9]+$/i, "");
}

async function syncUserProfileToNotion(profile: {
  name: string;
  email: string;
  country: string;
  city: string;
  style?: string;
  musicProvider: string;
  lastfmUsername?: string;
}) {
  const response = await fetch("/api/notion/sync-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });

  const data = await readApiJsonResponse(response);
  if (!response.ok || data.ok !== true) {
    throw new Error(typeof data.error === "string" ? data.error : "Notion 使用者同步失敗");
  }
}

export const TodayView: React.FC<{ navigateTo: (tab: "today" | "items" | "map") => void }> = ({ navigateTo }) => {
  const {
    currentMockDay,
    currentBaseKey,
    currentWeekItems,
    hatchSession,
    generateItem,
    advanceDay,
    resetWeek,
    generateWeeklyPet,
    addToMap,
    autoFillWeek,
    userProfile,
    updateUserProfile,
    saveTracksForCurrentDay,
    getFinalPetInput,
  } = useApp();

  const [mockMusic, setMockMusic] = useState<DailyMusicData | null>(null);
  const [showGenAnim, setShowGenAnim] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(Boolean(getStoredGeneratedImage()));
  const [imgLoadError, setImgLoadError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(() => getStoredGeneratedImage());
  const [generatedPetProvider, setGeneratedPetProvider] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAssetAnalysis | null>(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [notionPromptContext, setNotionPromptContext] = useState("");
  const [musicLoadError, setMusicLoadError] = useState<string | null>(null);
  const [musicLoadCode, setMusicLoadCode] = useState<string | null>(null);
  const [musicFetchDebug, setMusicFetchDebug] = useState<MusicFetchDebug | null>(null);
  const [recentDebug, setRecentDebug] = useState<MusicFetchDebug | null>(null);
  const [recentDebugError, setRecentDebugError] = useState<string | null>(null);
  const [testingRecentTracks, setTestingRecentTracks] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifyDisplayName, setSpotifyDisplayName] = useState<string | null>(null);
  const [showMusicSourcePanel, setShowMusicSourcePanel] = useState(false);
  const [draftLastfmUsername, setDraftLastfmUsername] = useState(userProfile?.lastfmUsername || "");
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedClothes, setSelectedClothes] = useState<string | null>(null);
  const [selectedShoes, setSelectedShoes] = useState<string | null>(null);
  const [selectedHeadwear, setSelectedHeadwear] = useState<string | null>(null);
  const [selectedHandheld, setSelectedHandheld] = useState<string | null>(null);
  const [selectedAccessory, setSelectedAccessory] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const [titleTapCount, setTitleTapCount] = useState(0);

  const safeDay = Math.min(Math.max(Number(currentMockDay) || 1, 1), TOTAL_DAYS);
  const safeWeekItems = Array.isArray(currentWeekItems) ? currentWeekItems : [];
  const currentDayDate = useMemo(
    () => (hatchSession?.startDate ? getDayDate(hatchSession.startDate, safeDay) : new Date().toISOString().slice(0, 10)),
    [hatchSession?.startDate, safeDay]
  );
  const showLastFmDebug = useMemo(() => {
    if (import.meta.env.DEV) return true;
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);
  const finalPetInput = useMemo(() => getFinalPetInput(), [getFinalPetInput, hatchSession]);
  const debugDaySummaries = useMemo(
    () =>
      ([1, 2, 3] as const).map((day) => {
        const dayState = hatchSession?.days?.[day];
        return {
          day,
          date: dayState?.date || "",
          songCount: dayState?.tracks?.length || 0,
          itemCount: dayState?.items?.length || 0,
          completed: Boolean(dayState?.completed),
        };
      }),
    [hatchSession]
  );
  const nextDayDate = useMemo(() => {
    const date = new Date(`${currentDayDate}T00:00:00`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, [currentDayDate]);
  const daySlotConfigs = getDaySlotConfigs(safeDay);
  const activeMusicProvider = userProfile?.musicProvider || "mock";
  const distribution = Array.isArray(mockMusic?.distribution) ? mockMusic.distribution : [];
  const primarySuggestedGenre = normalizeGenre((mockMusic?.assetGenre || mockMusic?.mainGenre || "Pop") as string) as Genre;
  const secondarySuggestedGenre = normalizeGenre((mockMusic?.subGenre || primarySuggestedGenre) as string) as Genre;

  const getCollectedItemByPart = (part: string) => {
    const index = getCollectionSlotIndex(part as MusicItem["part"]);
    return index >= 0 ? safeWeekItems[index] : null;
  };

  const todaysPreviewItems = daySlotConfigs.map((slot, index) => {
    const genre = (slot.genreSource === "main" ? primarySuggestedGenre : secondarySuggestedGenre) as Genre;
    return {
      id: `${safeDay}-${slot.part}-${index}`,
      day: safeDay,
      part: slot.part,
      genre,
      label: slot.title,
      icon: "",
      imageSrc: resolveAssetImage(genre, slot.part, `${genre}-${slot.part}-${safeDay}`),
    } as MusicItem;
  });
  const todaysGeneratedItems = daySlotConfigs
    .map((slot) => getCollectedItemByPart(slot.part))
    .filter((item): item is MusicItem => Boolean(item));
  const hasGeneratedToday = todaysGeneratedItems.length === daySlotConfigs.length;

  useEffect(() => {
    setDraftLastfmUsername(userProfile?.lastfmUsername || "");
  }, [userProfile?.lastfmUsername]);

  useEffect(() => {
    if (!import.meta.env.DEV || !hatchSession) return;

    console.groupCollapsed("[Playlist Pet] Hatch session debug");
    console.log("sessionId:", hatchSession.sessionId);
    console.log("startDate:", hatchSession.startDate);
    console.log("currentDay:", hatchSession.currentDay);
    console.table(debugDaySummaries);
    console.groupEnd();
  }, [debugDaySummaries, hatchSession]);

  useEffect(() => {
    let active = true;
    setShowGenAnim(false);
    setMusicLoadError(null);
    setMusicLoadCode(null);

    getTodayMusicData(activeMusicProvider, {
      lastfmUsername: userProfile?.lastfmUsername,
      dayStart: currentDayDate,
      dayEnd: nextDayDate,
      dayIndex: safeDay,
      startDate: hatchSession?.startDate,
    })
      .then((payload) => {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.info("[Playlist Pet] music fetch window", {
            provider: activeMusicProvider,
            day: safeDay,
            dayStart: currentDayDate,
            dayEnd: nextDayDate,
            trackCount: payload.tracks.length,
            debug: payload.debug || null,
          });
        }
        setMusicFetchDebug(
          payload.debug || {
            source: activeMusicProvider,
            username: userProfile?.lastfmUsername || "",
            currentDay: safeDay,
            startDate: hatchSession?.startDate || "",
            dayStartISO: currentDayDate,
            dayEndISO: nextDayDate,
            parsedTrackCount: payload.tracks.length,
          }
        );
        setMockMusic(payload.data);
        saveTracksForCurrentDay(payload.tracks, payload.data);
      })
      .catch((error: Error & { code?: string; debug?: MusicFetchDebug | null }) => {
        if (!active) return;
        setMusicFetchDebug(
          error.debug || {
            source: activeMusicProvider,
            username: userProfile?.lastfmUsername || "",
            currentDay: safeDay,
            startDate: hatchSession?.startDate || "",
            dayStartISO: currentDayDate,
            dayEndISO: nextDayDate,
            parsedTrackCount: 0,
            error: error.message || "音樂資料讀取失敗。",
          }
        );
        setMockMusic(null);
        setMusicLoadError(error.message || "音樂資料讀取失敗。");
        setMusicLoadCode(error.code || null);
      });

    return () => {
      active = false;
    };
  }, [safeDay, activeMusicProvider, userProfile?.lastfmUsername, currentDayDate, nextDayDate, hatchSession?.startDate]);

  useEffect(() => {
    if (activeMusicProvider !== "spotify") {
      setSpotifyConnected(null);
      setSpotifyDisplayName(null);
      return;
    }

    let active = true;
    fetch("/api/spotify/session", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        if (data?.ok === true && data.connected) {
          setSpotifyConnected(true);
          setSpotifyDisplayName(typeof data.displayName === "string" ? data.displayName : "Spotify User");
          return;
        }
        setSpotifyConnected(false);
        setSpotifyDisplayName(null);
      })
      .catch(() => {
        if (!active) return;
        setSpotifyConnected(false);
        setSpotifyDisplayName(null);
      });

    return () => {
      active = false;
    };
  }, [activeMusicProvider]);

  const collectedItems = safeWeekItems
    .slice(0, 5)
    .filter((item): item is MusicItem => Boolean(item?.genre && item?.part && item?.imageSrc));
  const isComplete = collectedItems.length === 5;
  const isPetGenerationStage = safeDay === TOTAL_DAYS && isComplete;

  const genreCounts: Record<string, number> = {};
  collectedItems.forEach((item) => {
    genreCounts[item.genre] = (genreCounts[item.genre] || 0) + 1;
  });

  let mainGenre: Genre = (collectedItems[0]?.genre || "Pop") as Genre;
  let subGenre: Genre = (collectedItems[1]?.genre || "Pop") as Genre;
  let maxCount = 0;
  Object.entries(genreCounts).forEach(([genre, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mainGenre = genre as Genre;
    }
  });

  let subMaxCount = 0;
  Object.entries(genreCounts).forEach(([genre, count]) => {
    if (genre !== mainGenre && count > subMaxCount) {
      subMaxCount = count;
      subGenre = genre as Genre;
    }
  });

  if (Object.keys(genreCounts).length === 1) {
    subGenre = mainGenre;
  }

  const baseImageSrc = baseShapeMap[currentBaseKey] || baseShapeMap["base-1"];
  const clothesItem = getCollectedItemByPart("clothes");
  const shoesItem = getCollectedItemByPart("shoes");
  const headwearItem = getCollectedItemByPart("headwear");
  const handheldItem = getCollectedItemByPart("handheld");
  const accessoryItem = getCollectedItemByPart("accessory");

  useEffect(() => {
    setSelectedBase(baseImageSrc);
    setSelectedClothes(clothesItem?.imageSrc || null);
    setSelectedShoes(shoesItem?.imageSrc || null);
    setSelectedHeadwear(headwearItem?.imageSrc || null);
    setSelectedHandheld(handheldItem?.imageSrc || null);
    setSelectedAccessory(accessoryItem?.imageSrc || null);
  }, [
    baseImageSrc,
    clothesItem?.imageSrc,
    shoesItem?.imageSrc,
    headwearItem?.imageSrc,
    handheldItem?.imageSrc,
    accessoryItem?.imageSrc,
  ]);

  const clearGeneratedWeeklyPetImage = () => {
    setGeneratedImageUrl(null);
    setError(null);
    setImgLoading(false);
    setImgLoadError(false);
    setImgLoaded(false);
    setGeneratedPetProvider(null);
    setAnalysis(null);
    setFinalPrompt("");

    try {
      localStorage.removeItem(GENERATED_WEEKLY_PET_IMAGE_KEY);
    } catch {
      // Ignore storage cleanup errors and keep the UI responsive.
    }
  };

  const handleGenerate = () => {
    if (!mockMusic) return;

    setShowGenAnim(true);
    setTimeout(() => {
      todaysPreviewItems.forEach((item) => {
        generateItem({
          ...item,
          id: generateId(),
          label: `${item.genre} ${item.part}`,
        });
      });
    }, 600);
  };

  const analyzeAndGeneratePet = async () => {
    if (!selectedBase || !selectedClothes || !selectedShoes || !selectedHeadwear || !selectedHandheld || !selectedAccessory) {
      setError("缺少 base 或素材圖片，請先完成 5 個素材收集。");
      return;
    }

    if (generatedImageUrl && !window.confirm("重新生成會覆蓋目前圖片，確定嗎？")) {
      return;
    }

    setError(null);
    setAnalysis(null);
    setFinalPrompt("");
    setNotionPromptContext("");
    setGeneratedImageUrl(null);
    setGeneratedPetProvider(null);
    setImgLoading(false);
    setImgLoadError(false);
    setImgLoaded(false);

    try {
      setIsAnalyzing(true);
      const formData = new FormData();
      await Promise.all([
        appendImageAssetToFormData(formData, "base", selectedBase),
        appendImageAssetToFormData(formData, "clothes", selectedClothes),
        appendImageAssetToFormData(formData, "shoes", selectedShoes),
        appendImageAssetToFormData(formData, "headwear", selectedHeadwear),
        appendImageAssetToFormData(formData, "handheld", selectedHandheld),
        appendImageAssetToFormData(formData, "accessory", selectedAccessory),
      ]);
      formData.append("mainGenre", mainGenre);
      formData.append("subGenre", subGenre);

      const analyzeResponse = await fetch("/api/analyze-assets", {
        method: "POST",
        body: formData,
      });
      const analyzeData = await readApiJsonResponse(analyzeResponse);
      if (!analyzeResponse.ok || !analyzeData.analysis || typeof analyzeData.analysis !== "object") {
        const message = typeof analyzeData.error === "string" ? analyzeData.error : "素材分析失敗，請重試";
        throw new Error(message);
      }

      const parsedAnalysis = analyzeData.analysis as unknown as GeminiAssetAnalysis;
      setAnalysis(parsedAnalysis);
      setFinalPrompt(parsedAnalysis.final_prompt_en || "");
      setNotionPromptContext(
        analyzeData.notion && typeof analyzeData.notion === "object" && typeof (analyzeData.notion as Record<string, unknown>).promptContext === "string"
          ? (((analyzeData.notion as Record<string, unknown>).promptContext as string) || "").trim()
          : ""
      );
      setIsAnalyzing(false);

      setIsGenerating(true);
      setImgLoading(true);
      const generateResponse = await fetch("/api/generate-pet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysis: parsedAnalysis,
        }),
      });

      const generateData = await readApiJsonResponse(generateResponse);
      if (!generateResponse.ok || typeof generateData.imageUrl !== "string" || !generateData.imageUrl) {
        const message = typeof generateData.error === "string" ? generateData.error : "生成失敗，請重試";
        throw new Error(message);
      }

      setGeneratedImageUrl(generateData.imageUrl);
      setGeneratedPetProvider("leonardo");
      try {
        localStorage.setItem(GENERATED_WEEKLY_PET_IMAGE_KEY, generateData.imageUrl);
      } catch {
        // Ignore quota errors so the generated image can still be displayed.
      }

      try {
        const weeklyRunResponse = await fetch("/api/notion/weekly-run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionName: `${userProfile?.name || "Anonymous"} - ${mainGenre} Week`,
            userName: userProfile?.name || "Anonymous",
            musicSource: activeMusicProvider,
            lastfmUsername: userProfile?.lastfmUsername || "",
            mainGenreKey: mainGenre,
            secondaryGenreKey: subGenre,
            analysisType:
              mockMusic?.mainGenre === "Mixed"
                ? "mixed"
                : mockMusic?.mainGenre === "Hidden"
                  ? "hidden"
                  : "pure",
            listenCount: finalPetInput.finalTracks.length || mockMusic?.songCount || 0,
            day1ClothesKey: extractAssetKeyFromPath(selectedClothes),
            day1ShoesKey: extractAssetKeyFromPath(selectedShoes),
            day2HeadwearKey: extractAssetKeyFromPath(selectedHeadwear),
            day2HandheldKey: extractAssetKeyFromPath(selectedHandheld),
            day3AccessoryKey: extractAssetKeyFromPath(selectedAccessory),
            baseKey: currentBaseKey,
            finalPrompt: parsedAnalysis.final_prompt_en || "",
            petImageUrl: generateData.imageUrl,
            status: "generated",
          }),
        });

        const weeklyRunData = await readApiJsonResponse(weeklyRunResponse);
        if (!weeklyRunResponse.ok || weeklyRunData.ok !== true) {
          throw new Error(typeof weeklyRunData.error === "string" ? weeklyRunData.error : "Notion 生成紀錄同步失敗");
        }
      } catch (syncError) {
        setError(syncError instanceof Error ? `寵物已生成，但同步到 Notion 失敗：${syncError.message}` : "寵物已生成，但同步到 Notion 失敗");
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "生成失敗，請重試";
      setError(message);
      setImgLoading(false);
      setImgLoadError(false);
      setImgLoaded(false);
    } finally {
      setIsAnalyzing(false);
      setIsGenerating(false);
    }
  };

  const handleDeployToMap = () => {
    if (!isComplete || !generatedImageUrl) return;

    const petId = generateId();
    const petName = `${mainGenre} 音樂精靈`;
    const newPet: Pet = {
      id: petId,
      name: petName,
      mainGenre,
      subGenre,
      baseType: getBaseType(mainGenre),
      weekNumber: 1,
      description: `由本週的音樂行程誕生，充滿 ${mainGenre} 的氣息。`,
      items: collectedItems,
    };
    generateWeeklyPet(newPet);

    const mapEntry: MapEntry = {
      id: generateId(),
      petId,
      pet: newPet,
      petImage: generatedImageUrl,
      petName,
      ownerName: userProfile?.name || "Anonymous",
      country: userProfile?.country || "Taiwan",
      city: userProfile?.city || "Taipei",
      mainGenre,
      secondGenre: subGenre,
      items: collectedItems,
      provider: generatedPetProvider || "leonardo",
      sourceDay: safeDay,
      sourceDate: currentDayDate,
      top: 50 + (Math.random() - 0.5) * 10,
      left: 50 + (Math.random() - 0.5) * 10,
    };

    addToMap(mapEntry);
    clearGeneratedWeeklyPetImage();
    resetWeek();
    navigateTo("map");
  };

  const handleConnectSpotify = () => {
    window.location.href = "/api/spotify/auth";
  };

  const handleDisconnectSpotify = () => {
    window.location.href = "/api/spotify/logout";
  };

  const handleResetWeek = () => {
    clearGeneratedWeeklyPetImage();
    resetWeek();
  };

  const handleAutoFillWeek = async () => {
    clearGeneratedWeeklyPetImage();
    await autoFillWeek();
  };

  const handleSecretTitleTap = () => {
    setTitleTapCount((count) => {
      const nextCount = count + 1;
      if (nextCount >= 5) {
        setShowDevTools((value) => !value);
        return 0;
      }
      return nextCount;
    });
  };

  useEffect(() => {
    if (titleTapCount === 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      setTitleTapCount(0);
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [titleTapCount]);

  const providerLabel =
    activeMusicProvider === "spotify"
      ? "Spotify 直連"
      : activeMusicProvider === "lastfm"
        ? "通用同步模式"
        : "體驗模式";
  const currentDayTrackCount = hatchSession?.days?.[safeDay]?.tracks?.length || 0;
  const currentDayItemCount = hatchSession?.days?.[safeDay]?.items?.length || todaysGeneratedItems.length;
  const currentDayXp = Math.min(300, currentDayTrackCount * 12 + currentDayItemCount * 40);
  const debugReason = useMemo(() => {
    if (activeMusicProvider !== "lastfm") return "目前不是 Last.fm / 通用同步模式。";
    if (!userProfile?.lastfmUsername?.trim()) return "Last.fm username 未设置";
    if (musicLoadCode === "LASTFM_API_KEY_MISSING") return "Last.fm API key missing";
    if (musicLoadCode === "LASTFM_API_ERROR") return "Last.fm API returned error";
    if (musicLoadCode === "LASTFM_USERNAME_REQUIRED") return "Last.fm username missing";
    if (musicFetchDebug?.error) return musicFetchDebug.error;
    if ((musicFetchDebug?.dayRangeRawCount || 0) === 0 && (musicFetchDebug?.recentRawCount || 0) > 0) {
      return "Last.fm recent tracks exist, but not in current hatch day.";
    }
    if ((musicFetchDebug?.recentRawCount || 0) === 0) return "Last.fm recent fallback returned 0 tracks.";
    if ((musicFetchDebug?.dayRangeRawCount || 0) > 0 && (musicFetchDebug?.parsedTrackCount || 0) === 0) {
      return "Last.fm returned tracks, but parser filtered them out.";
    }
    if (currentDayTrackCount === 0) return "Day range returned 0 usable tracks.";
    return "Last.fm day-range lookup appears normal.";
  }, [activeMusicProvider, currentDayTrackCount, musicFetchDebug, musicLoadCode, userProfile?.lastfmUsername]);
  const handleProviderChange = (provider: "mock" | "spotify" | "lastfm") => {
    updateUserProfile({ musicProvider: provider });
    if (userProfile) {
      syncUserProfileToNotion({
        name: userProfile.name,
        email: userProfile.email,
        country: userProfile.country,
        city: userProfile.city,
        style: userProfile.style,
        musicProvider: provider,
        lastfmUsername: provider === "lastfm" ? userProfile.lastfmUsername : "",
      }).catch(() => {
        // Keep source switching responsive even if Notion sync fails.
      });
    }
    if (provider !== "lastfm") {
      setShowMusicSourcePanel(false);
    }
  };

  const handleSaveLastfmUsername = () => {
    const nextProfile = {
      musicProvider: "lastfm",
      lastfmUsername: draftLastfmUsername.trim(),
    } as const;
    updateUserProfile(nextProfile);
    if (userProfile) {
      syncUserProfileToNotion({
        name: userProfile.name,
        email: userProfile.email,
        country: userProfile.country,
        city: userProfile.city,
        style: userProfile.style,
        musicProvider: "lastfm",
        lastfmUsername: draftLastfmUsername.trim(),
      }).catch(() => {
        // Keep Last.fm save responsive even if Notion sync fails.
      });
    }
    setShowMusicSourcePanel(false);
  };

  const handleDebugRecentTracks = async () => {
    if (activeMusicProvider !== "lastfm") return;

    setTestingRecentTracks(true);
    setRecentDebug(null);
    setRecentDebugError(null);

    try {
      const payload = await getTodayMusicData("lastfm", {
        lastfmUsername: userProfile?.lastfmUsername,
        dayStart: currentDayDate,
        dayEnd: nextDayDate,
        dayIndex: safeDay,
        startDate: hatchSession?.startDate,
        debugRecentOnly: true,
      });
      setRecentDebug(payload.debug || null);
    } catch (error) {
      const typedError = error as Error & { debug?: MusicFetchDebug | null };
      setRecentDebug(typedError.debug || null);
      setRecentDebugError(typedError.message || "Last.fm 最近 10 首測試失敗。");
    } finally {
      setTestingRecentTracks(false);
    }
  };

  if (!mockMusic && !musicLoadError) {
    return <div className="p-8 text-center type-body">加載今日音樂數據...</div>;
  }

  return (
    <div className="page-stack">
      <PixelStatusBar />
      <div onClick={handleSecretTitleTap}>
        <PixelLogoTitle
          kicker="DAILY QUEST"
          title={isPetGenerationStage ? "音樂寵物生成" : "今日任務"}
          subtitle="帶著今天的音樂資料與掉落素材，逐步孵化你的 Playlist Pet。"
        />
      </div>

      <RetroWindow title="冒險進度" tone="blue">
        <div className="quest-day-strip">
          {[1, 2, 3].map((day) => {
            const summary = debugDaySummaries.find((item) => item.day === day);
            const state = day < safeDay ? "done" : day === safeDay ? "active" : "locked";
            return (
              <div key={day} className={`quest-day-step is-${state}`}>
                <div className="quest-day-dot">
                  {state === "done" ? <PixelIcon type="check" size={18} /> : state === "locked" ? <PixelIcon type="lock" size={18} /> : day}
                </div>
                <div className="quest-day-text">Day {day}</div>
                <div className="quest-day-meta">{summary?.songCount || 0} songs</div>
              </div>
            );
          })}
        </div>
      </RetroWindow>

      <RetroWindow title="音樂來源" tone="yellow">
        <div className="window-stack-tight">
          <div className="window-title-row">
            <div>
              <div className="window-mini-title">音樂來源</div>
              <p className="window-copy">
                {activeMusicProvider === "spotify"
                  ? "Spotify 已連接後會直接讀近期播放與常聽風格。"
                  : activeMusicProvider === "lastfm"
                    ? "目前使用通用同步模式，透過 Last.fm 讀取近期紀錄。"
                    : "目前是體驗模式，使用示範資料。"}
              </p>
            </div>
            <PixelBadge tone={activeMusicProvider === "spotify" ? "green" : activeMusicProvider === "lastfm" ? "blue" : "yellow"}>
              {providerLabel}
            </PixelBadge>
          </div>

          <div className="window-button-row">
            <Button variant="secondary" className="w-full justify-center" onClick={() => setShowMusicSourcePanel((value) => !value)}>
              切換音樂來源
            </Button>
            {activeMusicProvider === "spotify" ? (
              <Button variant="primary" className="w-full justify-center" onClick={spotifyConnected ? handleDisconnectSpotify : handleConnectSpotify}>
                {spotifyConnected ? "已連接 Spotify" : "連接 Spotify"}
              </Button>
            ) : null}
          </div>

          {showMusicSourcePanel && (
            <div className="source-switch-panel">
              <button type="button" className={`source-switch-card ${activeMusicProvider === "spotify" ? "is-active" : ""}`} onClick={() => handleProviderChange("spotify")}>
                <div className="type-label">Spotify 直連</div>
                <div className="type-caption">直接授權最近播放與常聽風格。</div>
              </button>
              <button type="button" className={`source-switch-card ${activeMusicProvider === "lastfm" ? "is-active" : ""}`} onClick={() => handleProviderChange("lastfm")}>
                <div className="type-label">通用同步模式</div>
                <div className="type-caption">透過 Last.fm 同步其他音樂平台。</div>
              </button>
              {(activeMusicProvider === "lastfm" || showMusicSourcePanel) && (
                <div className="space-y-3">
                  <label className="passport-field">
                    <span className="window-label">Last.fm 使用者名稱</span>
                    <input
                      value={draftLastfmUsername}
                      onChange={(event) => setDraftLastfmUsername(event.target.value)}
                      className="pixel-input"
                      placeholder="例如：musiclover123"
                    />
                  </label>
                  <Button variant="secondary" className="w-full justify-center" onClick={handleSaveLastfmUsername} disabled={!draftLastfmUsername.trim()}>
                    儲存 Last.fm 帳號
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </RetroWindow>

      <RetroWindow title="主線任務" tone="pink">
        <div className="quest-main-grid">
          <div className="quest-main-visual">
            <PixelIcon type="egg" size={42} />
          </div>
          <div className="window-stack-tight">
            <div className="window-mini-title">孵化音樂寵物！</div>
            <p className="window-copy">收集 3 天音樂素材，逐步孵化屬於你的音樂寵物。</p>
            <PixelProgress label="XP" value={currentDayXp} max={300} color="var(--color-yellow)" />
          </div>
        </div>
      </RetroWindow>

      {musicLoadError ? (
        <RetroWindow title="資料尚未就緒" tone="yellow">
          <div className="window-stack-tight text-center">
            <div className="window-mini-title">音樂資料尚未就緒</div>
            <p className="window-error">{musicLoadError}</p>
            {activeMusicProvider === "spotify" ? (
              <Button variant="primary" className="w-full justify-center" onClick={handleConnectSpotify}>
                連接 Spotify
              </Button>
            ) : null}
            {activeMusicProvider === "lastfm" && musicLoadCode === "LASTFM_USERNAME_REQUIRED" ? (
              <p className="window-hint">目前登入資料沒有 Last.fm 使用者名稱，請回到入口頁重新填寫。</p>
            ) : null}
          </div>
        </RetroWindow>
      ) : null}

      {mockMusic ? (
        <RetroWindow title="風格分析" tone="blue">
          <div className="window-stack-tight">
            <div className="stats-mini-grid">
              <div className="stats-mini-card">
                <div className="type-caption">聽歌數量</div>
                <div className="window-mini-title">{currentDayTrackCount} 首</div>
              </div>
              <div className="stats-mini-card">
                <div className="type-caption">分析類型</div>
                <div className="window-mini-title">
                  {currentDayTrackCount === 0 ? "尚無資料" : mockMusic.mainGenre === "Mixed" ? "混合型" : mockMusic.mainGenre === "Hidden" ? "隱藏版" : "純粹型"}
                </div>
              </div>
            </div>

            <div className="window-label">風格分布</div>
            <div className="quest-style-bars">
              {distribution.length > 0 ? (
                distribution.map((item, index) => (
                  <div key={`${item.genre}-${index}`} className="quest-style-row">
                    <div className="quest-style-copy">
                      <span>{item.genre}</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <PixelProgress value={item.percentage} max={100} color={index === 0 ? "var(--color-pink)" : index === 1 ? "var(--color-primary)" : "var(--color-yellow)"} />
                  </div>
                ))
              ) : (
                <div className="window-hint">今天這個時段還沒有同步到可分析的播放紀錄。</div>
              )}
            </div>

            <div className="quote-window">“{mockMusic.quote}”</div>
          </div>
        </RetroWindow>
      ) : null}

      {mockMusic ? (
        <RetroWindow title="今日獎勵" tone="green">
          {!hasGeneratedToday ? (
            <div className="window-stack-tight">
              <div className="quest-reward-grid">
                {todaysPreviewItems.map((item) => (
                  <PixelItemCard key={item.id} item={item} fallbackDay={safeDay} />
                ))}
              </div>
              <div className="quest-reward-meta">
                Day {safeDay} 會生成 {daySlotConfigs.map((slot) => slot.part).join(" + ")}
              </div>
              <Button variant="primary" className="w-full justify-center" onClick={handleGenerate}>
                確認今日分析並生成素材
              </Button>
            </div>
          ) : (
            <div className="window-stack-tight">
              <div className="quest-reward-grid">
                {todaysGeneratedItems.map((item) => (
                  <PixelItemCard key={item.id} item={item} fallbackDay={safeDay} />
                ))}
              </div>
              <div className="window-hint text-center">今日掉落已收錄至本週收藏。</div>
            </div>
          )}
        </RetroWindow>
      ) : null}

      {isPetGenerationStage ? (
        <RetroWindow title="風格分析升級" tone="blue">
          <div className="window-stack-tight">
            <div className="window-title-row">
              <div>
                <div className="window-mini-title">{mainGenre} 音樂精靈</div>
                <p className="window-copy">深入分析你的音樂素材，解鎖更完整的最終寵物！</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <PixelBadge tone="pink">主：{mainGenre}</PixelBadge>
                <PixelBadge tone="yellow">副：{subGenre}</PixelBadge>
              </div>
            </div>

            <div className="analysis-asset-grid">
              {[
                { key: "base", src: selectedBase, label: "base" },
                { key: "clothes", src: selectedClothes, label: "clothes" },
                { key: "shoes", src: selectedShoes, label: "shoes" },
                { key: "headwear", src: selectedHeadwear, label: "headwear" },
                { key: "handheld", src: selectedHandheld, label: "handheld" },
                { key: "accessory", src: selectedAccessory, label: "accessory" },
              ].map((item) => (
                <div key={item.key} className="analysis-asset-tile">
                  {item.src ? <img src={item.src} alt={item.label} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} /> : null}
                </div>
              ))}
            </div>

            {error ? <div className="window-error">{error}</div> : null}

            {(isAnalyzing || analysis || finalPrompt) ? (
              <div className="analysis-result-window">
                <div className="window-title-row">
                  <div className="window-mini-title">素材分析結果</div>
                  {isAnalyzing ? <div className="window-hint">正在分析素材…</div> : null}
                </div>

                {notionPromptContext ? (
                  <div className="analysis-copy-block">
                    <div className="window-label">Notion 風格參考</div>
                    <div className="window-hint whitespace-pre-wrap">{notionPromptContext}</div>
                  </div>
                ) : null}

                {analysis ? (
                  <div className="analysis-copy-block">
                    <div className="window-hint"><strong>Base：</strong>{analysis.base_description}</div>
                    <div className="window-hint"><strong>Clothes：</strong>{analysis.clothes_description}</div>
                    <div className="window-hint"><strong>Shoes：</strong>{analysis.shoes_description}</div>
                    <div className="window-hint"><strong>Headwear：</strong>{analysis.headwear_description}</div>
                    <div className="window-hint"><strong>Handheld：</strong>{analysis.handheld_description}</div>
                    <div className="window-hint"><strong>Accessory：</strong>{analysis.accessory_description}</div>
                    <div className="window-hint"><strong>Style：</strong>{analysis.style_summary}</div>
                  </div>
                ) : null}

                {finalPrompt ? (
                  <div className="analysis-copy-block">
                    <div className="window-label">Gemini final_prompt_en</div>
                    <pre className="analysis-prompt-block">{finalPrompt}</pre>
                  </div>
                ) : null}

                {isGenerating ? <div className="window-hint">正在生成寵物…</div> : null}
              </div>
            ) : null}

            {generatedImageUrl ? (
              <div className="window-stack-tight">
                <div className="pixel-generated-frame">
                  {imgLoading ? <div className="generated-overlay">正在載入圖片...</div> : null}
                  {imgLoadError ? <div className="generated-overlay error">圖片暫時載入失敗，請重新生成或稍後再試。</div> : null}
                  <img
                    src={generatedImageUrl}
                    alt="Generated Pet"
                    className="w-full h-full object-contain"
                    onLoad={() => {
                      setImgLoading(false);
                      setImgLoadError(false);
                      setImgLoaded(true);
                    }}
                    onError={() => {
                      setImgLoading(false);
                      setImgLoadError(true);
                      setImgLoaded(false);
                    }}
                  />
                </div>
                {imgLoaded && !imgLoadError ? <div className="window-success">生成成功！</div> : null}
                <Button variant="blue" className="w-full justify-center" onClick={analyzeAndGeneratePet} disabled={isAnalyzing || isGenerating}>
                  {isAnalyzing ? "正在分析素材..." : isGenerating ? "正在生成寵物..." : "ANALYZE NOW"}
                </Button>
              </div>
            ) : (
              <Button variant="blue" className="w-full justify-center" onClick={analyzeAndGeneratePet} disabled={isAnalyzing || isGenerating}>
                {isAnalyzing ? "正在分析素材..." : isGenerating ? "正在生成寵物..." : "ANALYZE NOW"}
              </Button>
            )}
          </div>
        </RetroWindow>
      ) : null}

      <Button variant="primary" className="w-full justify-center" onClick={handleDeployToMap} disabled={!generatedImageUrl || isAnalyzing || isGenerating}>
        OPEN MAP
      </Button>

      {showDevTools ? (
        <RetroWindow title="DEV TOOLS" tone="yellow">
          <div className="window-stack-tight">
            <div className="window-hint"><strong>startDate:</strong> {hatchSession?.startDate || "-"}</div>
            <div className="window-hint"><strong>currentDay:</strong> {hatchSession?.currentDay || safeDay}</div>
            <div className="window-hint"><strong>dayStart:</strong> {musicFetchDebug?.dayStartISO || currentDayDate}</div>
            <div className="window-hint"><strong>dayEnd:</strong> {musicFetchDebug?.dayEndISO || nextDayDate}</div>
            <div className="window-hint"><strong>apiTrackCount:</strong> {musicFetchDebug?.parsedTrackCount ?? 0} ({musicFetchDebug?.source || activeMusicProvider})</div>
            <div className="space-y-1">
              {debugDaySummaries.map((summary) => (
                <div key={summary.day} className="window-hint flex items-center justify-between gap-2">
                  <span>Day {summary.day} · {summary.date || "-"}</span>
                  <span>songs {summary.songCount} / items {summary.itemCount} / {summary.completed ? "done" : "pending"}</span>
                </div>
              ))}
            </div>
            <div className="window-button-row">
              <Button variant="secondary" className="w-full justify-center" onClick={advanceDay} disabled={safeDay >= TOTAL_DAYS}>
                模擬下一天
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={handleResetWeek}>
                重置本週
              </Button>
            </div>
            <Button variant="secondary" className="w-full justify-center" onClick={handleAutoFillWeek}>
              一鍵生成三天
            </Button>
          </div>
        </RetroWindow>
      ) : null}

      {showLastFmDebug ? (
        <RetroWindow title="Last.fm Debug" tone="yellow">
          <div className="window-stack-tight">
            <div className="window-hint"><strong>目前來源：</strong>{providerLabel}</div>
            <div className="window-hint"><strong>Last.fm username：</strong>{userProfile?.lastfmUsername?.trim() || "未设置"}</div>
            <div className="window-hint"><strong>currentDay：</strong>{musicFetchDebug?.currentDay ?? safeDay}</div>
            <div className="window-hint"><strong>startDate：</strong>{musicFetchDebug?.startDate || hatchSession?.startDate || "-"}</div>
            <div className="window-hint"><strong>localToday：</strong>{musicFetchDebug?.localToday || "-"}</div>
            <div className="window-hint"><strong>timezoneOffset：</strong>{musicFetchDebug?.timezoneOffset ?? "-"}</div>
            <div className="window-hint"><strong>dayStartLocal：</strong>{musicFetchDebug?.dayStartLocalString || "-"}</div>
            <div className="window-hint"><strong>dayEndLocal：</strong>{musicFetchDebug?.dayEndLocalString || "-"}</div>
            <div className="window-hint"><strong>dayStartISO：</strong>{musicFetchDebug?.dayStartISO || "-"}</div>
            <div className="window-hint"><strong>dayEndISO：</strong>{musicFetchDebug?.dayEndISO || "-"}</div>
            <div className="window-hint"><strong>fromUnix：</strong>{musicFetchDebug?.fromUnix ?? "-"}</div>
            <div className="window-hint"><strong>toUnix：</strong>{musicFetchDebug?.toUnix ?? "-"}</div>
            <div className="window-hint"><strong>dayRange URL：</strong>{musicFetchDebug?.dayRangeRequestUrlWithoutApiKey || musicFetchDebug?.requestUrlWithoutApiKey || "-"}</div>
            <div className="window-hint"><strong>recent URL：</strong>{musicFetchDebug?.recentRequestUrlWithoutApiKey || "-"}</div>
            <div className="window-hint"><strong>dayRangeRawCount：</strong>{musicFetchDebug?.dayRangeRawCount ?? 0}</div>
            <div className="window-hint"><strong>dayRangeParsedCount：</strong>{musicFetchDebug?.dayRangeParsedCount ?? 0}</div>
            <div className="window-hint"><strong>recentRawCount：</strong>{musicFetchDebug?.recentRawCount ?? 0}</div>
            <div className="window-hint"><strong>parsedTrackCount：</strong>{musicFetchDebug?.parsedTrackCount ?? 0}</div>
            <div className="window-hint"><strong>debug reason：</strong>{debugReason}</div>
            {musicFetchDebug?.filteredOutReason ? <div className="window-hint"><strong>filteredOutReason：</strong>{musicFetchDebug.filteredOutReason}</div> : null}
            {musicFetchDebug?.error ? <div className="window-error">{musicFetchDebug.error}</div> : null}
            {musicLoadError && !musicFetchDebug?.error ? <div className="window-error">{musicLoadError}</div> : null}

            <div className="analysis-copy-block">
              <div className="window-label">dayRange first tracks</div>
              {(musicFetchDebug?.rawFirstTracks || []).length > 0 ? (
                <div className="space-y-2">
                  {(musicFetchDebug?.rawFirstTracks || []).map((track, index) => (
                    <div key={`${track.name}-${index}`} className="window-hint">
                      {index + 1}. {track.name} / {track.artist} / uts: {track.dateUts || "-"} / nowplaying: {track.nowplaying ? "true" : "false"}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="window-hint">沒有 day range tracks</div>
              )}
            </div>

            <div className="analysis-copy-block">
              <div className="window-label">recent first tracks</div>
              {(musicFetchDebug?.recentFirstTracks || []).length > 0 ? (
                <div className="space-y-2">
                  {(musicFetchDebug?.recentFirstTracks || []).map((track, index) => (
                    <div key={`${track.name}-${index}`} className="window-hint">
                      {index + 1}. {track.name} / {track.artist} / uts: {track.dateUts || "-"} / nowplaying: {track.nowplaying ? "true" : "false"}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="window-hint">沒有 recent tracks</div>
              )}
            </div>

            {activeMusicProvider === "lastfm" ? (
              <>
                <Button variant="secondary" className="w-full justify-center" onClick={handleDebugRecentTracks} disabled={testingRecentTracks}>
                  {testingRecentTracks ? "測試中..." : "測試 Last.fm 最近 10 首"}
                </Button>
                {recentDebugError ? <div className="window-error">{recentDebugError}</div> : null}
                {recentDebug ? (
                  <div className="analysis-copy-block">
                    <div className="window-label">recent-only test</div>
                    <div className="window-hint"><strong>request：</strong>{recentDebug.requestUrlWithoutApiKey || recentDebug.recentRequestUrlWithoutApiKey || "-"}</div>
                    <div className="window-hint"><strong>recentRawCount：</strong>{recentDebug.recentRawCount ?? 0}</div>
                    <div className="window-hint"><strong>parsedTrackCount：</strong>{recentDebug.parsedTrackCount ?? 0}</div>
                    {(recentDebug.recentFirstTracks || []).length > 0 ? (
                      <div className="space-y-2">
                        {(recentDebug.recentFirstTracks || []).map((track, index) => (
                          <div key={`${track.name}-${index}`} className="window-hint">
                            {index + 1}. {track.name} / {track.artist} / uts: {track.dateUts || "-"} / nowplaying: {track.nowplaying ? "true" : "false"}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="window-hint">最近 10 首也沒有可顯示資料</div>
                    )}
                    {recentDebug.filteredOutReason ? <div className="window-hint"><strong>reason：</strong>{recentDebug.filteredOutReason}</div> : null}
                    {recentDebug.error ? <div className="window-error">{recentDebug.error}</div> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </RetroWindow>
      ) : null}
    </div>
  );
};
