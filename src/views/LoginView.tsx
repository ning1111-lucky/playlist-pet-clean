import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useApp } from "../AppContext";
import { MusicProvider } from "../types";
import { getLastFmTodayMusicData } from "../mockData";
import homeBg from "../assets/pixel/backgrounds/home-bg.png";
import {
  PixelBadge,
  PixelButton,
  PixelIcon,
  PixelIconType,
  RetroWindow,
} from "../components/UI";
import { UI_ASSETS } from "../uiAssets";

type OnboardingStep = "home" | "source" | "passport";

const LASTFM_PROVIDER = {
  value: "lastfm" as MusicProvider,
  badge: "LAST.FM",
  title: "Last.fm 同步",
  subtitle: "請先在 Last.fm 連接 Spotify Scrobbling，然後輸入你的 Last.fm username。",
  hint: "本網站會讀取你的 Last.fm 今日聽歌紀錄，用來生成音樂寵物。",
  icon: "globe" as PixelIconType,
  tone: "blue" as const,
};

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToLocalDateKey(dateKey: string, offset: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toLocalDateKey(date);
}

async function readApiJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const rawText = await response.text().catch(() => "");
  if (!rawText.trim()) {
    return { error: "同步失敗，請重試" };
  }

  try {
    const parsed = JSON.parse(rawText);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { error: "同步失敗，請重試" };
  } catch {
    return { error: rawText.trim() || "同步失敗，請重試" };
  }
}

function PixelGameboy() {
  return (
    <div className="pixel-prop-gameboy" aria-hidden="true">
      <img src={UI_ASSETS.gameboy} alt="" className="pixel-art-image" />
    </div>
  );
}

function PixelDecorationLayer() {
  return (
    <div className="home-decoration-layer" aria-hidden="true">
      <div className="home-prop home-prop-gameboy">
        <PixelGameboy />
      </div>
      <div className="home-prop home-prop-headphone">
        <PixelIcon type="headphone" size={54} />
      </div>
      <div className="home-prop home-prop-cassette">
        <PixelIcon type="cassette" size={50} />
      </div>

      <span className="home-prop home-prop-note-a">
        <PixelIcon type="music-note" size={18} />
      </span>
      <span className="home-prop home-prop-note-b">
        <PixelIcon type="music-note" size={16} />
      </span>
      <span className="home-prop home-prop-note-c">
        <PixelIcon type="music-note" size={14} />
      </span>
      <span className="home-prop home-prop-heart-a">
        <PixelIcon type="heart" size={16} />
      </span>
      <span className="home-prop home-prop-heart-b">
        <PixelIcon type="heart" size={14} />
      </span>
      <span className="home-prop home-prop-star-a">
        <PixelIcon type="star" size={18} />
      </span>
      <span className="home-prop home-prop-star-b">
        <PixelIcon type="star" size={14} />
      </span>
      <span className="home-prop home-prop-spark-a">
        <PixelIcon type="spark" size={14} />
      </span>
      <span className="home-prop home-prop-spark-b">
        <PixelIcon type="spark" size={18} />
      </span>

    </div>
  );
}

function HomeStatusBar() {
  return (
    <div className="pixel-status-bar home-status-bar">
      <div className="status-cluster">
        <div className="status-avatar">
          <img src={UI_ASSETS.catAvatar} alt="" className="status-avatar-image pixel-art-image" />
        </div>
        <div className="status-level-stack">
          <div className="status-level-label">LV.01</div>
          <div className="status-xp-track">
            <span className="status-xp-fill" style={{ width: "36%" }} />
          </div>
        </div>
      </div>

      <div className="status-actions">
        <div className="status-gem-chip">
          <PixelIcon type="gem" size={18} />
          <span>120</span>
        </div>
        <button type="button" className="status-action-button" aria-label="新增">
          <PixelIcon type="plus" size={16} />
        </button>
        <button type="button" className="status-action-button status-menu-button" aria-label="選單">
          <PixelIcon type="menu" size={16} />
        </button>
      </div>
    </div>
  );
}

function PixelPinkCat() {
  return (
    <div className="stage-pet stage-pet-pink" aria-hidden="true">
      <div className="stage-pet-sprite">
        <img src={UI_ASSETS.pinkCatPet} alt="" className="stage-pet-image pixel-art-image" />
      </div>
      <div className="stage-pet-bubble">
        <PixelIcon type="heart" size={12} />
      </div>
    </div>
  );
}

function PixelBlueCat() {
  return (
    <div className="stage-pet stage-pet-blue" aria-hidden="true">
      <div className="stage-pet-sprite">
        <img src={UI_ASSETS.blueCatPet} alt="" className="stage-pet-image pixel-art-image" />
      </div>
      <div className="stage-pet-headphone">
        <PixelIcon type="headphone" size={18} />
      </div>
      <div className="stage-pet-bubble">
        <PixelIcon type="heart" size={12} />
      </div>
    </div>
  );
}

function PixelPetEgg() {
  return (
    <div className="stage-egg" aria-hidden="true">
      <div className="stage-egg-shell">
        <img src={UI_ASSETS.musicEgg} alt="" className="stage-egg-image pixel-art-image" />
      </div>
    </div>
  );
}

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="page-stack home-screen">
      <section className="home-start-scene" style={{ backgroundImage: `url(${homeBg})` }}>
        <PixelDecorationLayer />
        <HomeStatusBar />

        <section className="home-logo-area">
          <div className="home-logo-stack">
            <div className="home-logo-title home-logo-title-playlist">PLAYLIST</div>
            <div className="home-logo-title home-logo-title-pet">PET</div>
          </div>
          <p className="home-logo-subtitle">把你的聽歌紀錄孵化成音樂寵物</p>
          <div className="home-slogan-bar">
            <span className="home-slogan-icon">
              <PixelIcon type="heart" size={14} />
            </span>
            <span>PRESS START TO HATCH!</span>
            <span className="home-slogan-icon">
              <PixelIcon type="music-note" size={14} />
            </span>
          </div>
        </section>

        <section className="home-stage">
          <PixelPinkCat />
          <PixelPetEgg />
          <PixelBlueCat />
        </section>

        <RetroWindow
          title="開始音樂旅程"
          tone="pink"
          className="home-start-window"
          bodyClassName="window-stack-tight text-center home-start-window-body"
        >
          <p className="window-copy home-start-copy">
            連結你的音樂帳號，
            <br />
            讓 <strong>Playlist Pet</strong> 開始認識你的音樂宇宙！
          </p>
          <PixelButton variant="pink" className="w-full justify-center home-start-button" onClick={onStart}>
            START
          </PixelButton>
        </RetroWindow>
      </section>
    </div>
  );
}

function SourceSelectView({
  lastfmUsername,
  onUsernameChange,
  onSave,
  onTestRecentTracks,
  isTestingRecentTracks,
  testResult,
  onBack,
}: {
  lastfmUsername: string;
  onUsernameChange: (value: string) => void;
  onSave: () => void;
  onTestRecentTracks: () => void;
  isTestingRecentTracks: boolean;
  testResult: string | null;
  onBack: () => void;
}) {
  return (
    <div className="page-stack">
      <HomeStatusBar />
      <div className="source-page-title">
        <div className="source-page-kicker">MUSIC SOURCE</div>
        <h1 className="source-page-heading">音樂來源設定</h1>
        <p className="source-page-subtitle">
          請先在 Last.fm 連接 Spotify Scrobbling，然後輸入你的 Last.fm username。
          <br />
          本網站會讀取你的 Last.fm 今日聽歌紀錄，用來生成音樂寵物。
        </p>
      </div>

      <RetroWindow title="音樂來源設定" tone="yellow">
        <div className="source-screen-stack">
          <div className="source-window-card source-window-card-large">
            <div className="source-window-card-head">
              <div className="source-window-icon">
                <PixelIcon type={LASTFM_PROVIDER.icon} size={28} />
              </div>
              <div className="source-window-copy">
                <div className="source-window-copy-row source-window-copy-row-start">
                  <PixelBadge tone={LASTFM_PROVIDER.tone}>{LASTFM_PROVIDER.badge}</PixelBadge>
                </div>
                <h3 className="window-mini-title">{LASTFM_PROVIDER.title}</h3>
                <p className="window-copy">{LASTFM_PROVIDER.subtitle}</p>
                <p className="window-hint">{LASTFM_PROVIDER.hint}</p>
              </div>
            </div>

            <label className="passport-field">
              <span className="window-label">Last.fm username</span>
              <input
                value={lastfmUsername}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="例如：musiclover123"
                className="pixel-input"
              />
            </label>

            <div className="window-hint">
              如果你使用 Spotify，請先到 Last.fm：
              <br />
              Settings → Applications → Spotify Scrobbling → Connect
            </div>

            {testResult ? <div className="window-hint">{testResult}</div> : null}

            <div className="window-button-row">
              <PixelButton className="w-full justify-center" variant="blue" onClick={onSave} disabled={!lastfmUsername.trim()}>
                儲存並讀取音樂
              </PixelButton>
              <PixelButton className="w-full justify-center" variant="secondary" onClick={onTestRecentTracks} disabled={!lastfmUsername.trim() || isTestingRecentTracks}>
                {isTestingRecentTracks ? "測試中..." : "測試最近 10 首"}
              </PixelButton>
            </div>
          </div>

          <PixelButton variant="secondary" className="w-full justify-center" onClick={onBack}>
            BACK
          </PixelButton>
        </div>
      </RetroWindow>
    </div>
  );
}

export const LoginView: React.FC = () => {
  const { login } = useApp();
  const [step, setStep] = useState<OnboardingStep>("home");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [style, setStyle] = useState("");
  const musicProvider: MusicProvider = "lastfm";
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isTestingRecentTracks, setIsTestingRecentTracks] = useState(false);
  const [recentTrackTestResult, setRecentTrackTestResult] = useState<string | null>(null);

  const selectedProvider = useMemo(() => LASTFM_PROVIDER, []);

  const handleTestRecentTracks = async () => {
    const username = lastfmUsername.trim();
    if (!username) {
      setRecentTrackTestResult("請先輸入 Last.fm username。");
      return;
    }

    const today = toLocalDateKey(new Date());
    const tomorrow = addDaysToLocalDateKey(today, 1);
    setIsTestingRecentTracks(true);
    setRecentTrackTestResult(null);

    try {
      const payload = await getLastFmTodayMusicData(username, {
        dayStart: today,
        dayEnd: tomorrow,
        dayIndex: 1,
        startDate: today,
        debugRecentOnly: true,
      });
      const parsedTrackCount = payload.debug?.parsedTrackCount ?? payload.tracks.length;
      const recentRawCount = payload.debug?.recentRawCount ?? 0;
      setRecentTrackTestResult(
        parsedTrackCount > 0
          ? `最近 10 首測試成功，讀到 ${parsedTrackCount} 首可用歌曲。`
          : recentRawCount > 0
            ? "Last.fm 最近 10 首有資料，但目前沒有可用歌曲落在今日視窗。"
            : "尚未讀到 Last.fm 播放紀錄。請確認你已在 Last.fm 連接 Spotify Scrobbling，並且 Spotify 已播放歌曲。"
      );
    } catch (error) {
      setRecentTrackTestResult(error instanceof Error ? error.message : "Last.fm 最近 10 首測試失敗。");
    } finally {
      setIsTestingRecentTracks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const needsLastFmUsername = musicProvider === "lastfm";
    if (!(name && email && country && city && agreed && (!needsLastFmUsername || lastfmUsername.trim()))) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/notion/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          country,
          city,
          style,
          musicProvider,
          lastfmUsername,
        }),
      });

      const data = await readApiJsonResponse(response);
      if (!response.ok || data.ok !== true) {
        throw new Error(typeof data.error === "string" ? data.error : "Notion 使用者同步失敗");
      }

      login({ name, email, country, city, style, musicProvider, lastfmUsername, agreed });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Notion 使用者同步失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSource = () => {
    if (!lastfmUsername.trim()) {
      setRecentTrackTestResult("請先輸入 Last.fm username。");
      return;
    }
    setStep("passport");
  };

  if (step === "home") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-stack">
        <HomeScreen onStart={() => setStep("source")} />
      </motion.div>
    );
  }

  if (step === "source") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-stack">
        <SourceSelectView
          lastfmUsername={lastfmUsername}
          onUsernameChange={setLastfmUsername}
          onSave={handleSaveSource}
          onTestRecentTracks={handleTestRecentTracks}
          isTestingRecentTracks={isTestingRecentTracks}
          testResult={recentTrackTestResult}
          onBack={() => setStep("home")}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-stack">
      <HomeStatusBar />

      <div className="source-page-title">
        <div className="source-page-kicker">MUSIC PASSPORT</div>
        <h1 className="source-page-heading">音樂護照</h1>
        <p className="source-page-subtitle">完成旅程設定，然後開始收集 3 天素材。</p>
      </div>

      <RetroWindow title="建立你的音樂護照" tone="green">
        <div className="passport-provider-banner">
          <div>
            <div className="window-label">已選音樂入口</div>
            <div className="window-mini-title mt-1">{selectedProvider.title}</div>
          </div>
          <PixelBadge tone="blue">{selectedProvider.badge}</PixelBadge>
        </div>

        <form onSubmit={handleSubmit} className="passport-form-grid">
          <label className="passport-field">
            <span className="window-label">姓名 / 暱稱</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Aning" className="pixel-input" />
          </label>
          <label className="passport-field">
            <span className="window-label">Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="pixel-input" />
          </label>
          <label className="passport-field">
            <span className="window-label">國家 / 地區</span>
            <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="台灣" className="pixel-input" />
          </label>
          <label className="passport-field">
            <span className="window-label">城市</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="台北" className="pixel-input" />
          </label>
          <label className="passport-field">
            <span className="window-label">穿搭風格（選填）</span>
            <input value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Y2K、復古、街頭…" className="pixel-input" />
          </label>

          <label className="passport-field">
            <span className="window-label">Last.fm 使用者名稱</span>
            <input value={lastfmUsername} onChange={(event) => setLastfmUsername(event.target.value)} placeholder="例如：musiclover123" className="pixel-input" />
          </label>

          <label className="passport-checkbox-row">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>我同意將音樂紀錄用於設計展示研究（不串接真實資料庫）。</span>
          </label>

          {submitError ? <div className="window-error">{submitError}</div> : null}

          <div className="passport-actions">
            <PixelButton
              type="submit"
              className="w-full justify-center"
              disabled={isSubmitting || !agreed || !name || !email || !country || !city || !lastfmUsername.trim()}
            >
              {isSubmitting ? "同步中..." : "開始音樂旅程"}
            </PixelButton>
            <PixelButton type="button" variant="secondary" className="w-full justify-center" onClick={() => setStep("source")}>
              BACK
            </PixelButton>
          </div>
        </form>
      </RetroWindow>
    </motion.div>
  );
};
