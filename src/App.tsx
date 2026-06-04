/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "./AppContext";
import { LoginView } from "./views/LoginView";
import { TodayView } from "./views/TodayView";
import { CollectionView } from "./views/CollectionView";
import { MapView } from "./views/MapView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PixelIcon } from "./components/UI";

const ACTIVE_TAB_STORAGE_KEY = "melody_active_tab";
const VALID_TABS = ["today", "items", "map"] as const;
type ActiveTab = typeof VALID_TABS[number];

const getInitialActiveTab = (): ActiveTab => {
  try {
    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    const legacyTabMap: Record<string, ActiveTab> = {
      Today: "today",
      today: "today",
      Items: "items",
      items: "items",
      Map: "map",
      map: "map",
      pokedex: "today",
    };
    const safeTab = savedTab ? legacyTabMap[savedTab] || (savedTab as ActiveTab) : "today";
    return VALID_TABS.includes(safeTab) ? safeTab : "today";
  } catch (error) {
    console.error("Failed to load activeTab", error);
    return "today";
  }
};

const BottomNavIcon = ({ type, active }: { type: string; active: boolean }) => {
  return (
    <div className="modern-tab-icon">
      {type === "today" && <PixelIcon type="music-note" size={20} />}
      {type === "items" && <PixelIcon type="backpack" size={20} />}
      {type === "map" && <PixelIcon type="map" size={20} />}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { userProfile } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialActiveTab);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  return (
    <div className="webapp-outer">
      <div className="webapp-shell">
        <main className="webapp-content">
          {!userProfile ? (
            <LoginView />
          ) : (
            <>
              {activeTab === "today" && <TodayView navigateTo={setActiveTab} />}
              {activeTab === "items" && <CollectionView navigateTo={setActiveTab} />}
              {activeTab === "map" && <MapView />}
            </>
          )}
        </main>

        <nav className="mobile-bottom-nav">
          <button onClick={() => setActiveTab("today")} className={`pixel-nav-tab ${activeTab === "today" ? "pixel-nav-tab-active" : ""}`}>
            <BottomNavIcon type="today" active={activeTab === "today"} />
            <span className="pixel-nav-tab-label">今日</span>
          </button>
          <button onClick={() => setActiveTab("items")} className={`pixel-nav-tab ${activeTab === "items" ? "pixel-nav-tab-active" : ""}`}>
            <BottomNavIcon type="items" active={activeTab === "items"} />
            <span className="pixel-nav-tab-label">物品</span>
          </button>
          <button onClick={() => setActiveTab("map")} className={`pixel-nav-tab ${activeTab === "map" ? "pixel-nav-tab-active" : ""}`}>
            <BottomNavIcon type="map" active={activeTab === "map"} />
            <span className="pixel-nav-tab-label">地圖</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
