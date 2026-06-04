import React from "react";
import { useApp } from "../AppContext";
import { Button, PixelBadge, PixelIcon, PixelItemCard, PixelLogoTitle, PixelPetPreview, PixelProgress, PixelStatusBar, RetroWindow, getPartIconType } from "../components/UI";
import { MusicItem } from "../types";

export const CollectionView: React.FC<{ navigateTo: (tab: "today" | "items" | "map") => void }> = ({ navigateTo }) => {
  const { currentWeekItems } = useApp();

  const safeWeekItems = Array.isArray(currentWeekItems) ? currentWeekItems.filter(Boolean) as MusicItem[] : [];
  const collectedCount = safeWeekItems.length;
  const bagSlots = Array.from({ length: 6 }, (_, index) => safeWeekItems[index] || null);
  const groupedByDay = [1, 2, 3].map((day) => ({
    day,
    items: safeWeekItems.filter((item) => item.sourceDay === day),
  }));

  return (
    <div className="page-stack">
      <PixelStatusBar />
      <PixelLogoTitle kicker="ITEM COLLECTION" title="物品收藏" subtitle="整理本週收錄的服裝、鞋子、耳機與配件，準備為 Playlist Pet 裝備出擊。" />

      <RetroWindow title="收集進度" tone="yellow">
        <div className="window-stack-tight">
          <div className="window-title-row">
            <div>
              <div className="window-mini-title">Collected {collectedCount} / 5</div>
              <p className="window-hint">每完成一天任務，就會解鎖對應的風格收藏物件。</p>
            </div>
            <PixelBadge tone="pink" className="inline-flex items-center gap-2">
              <PixelIcon type="star" size={16} />
              收藏進度
            </PixelBadge>
          </div>
          <PixelProgress value={collectedCount} max={5} color="var(--color-pink)" />
        </div>
      </RetroWindow>

      <RetroWindow title="我的物品包" tone="pink">
        <div className="collection-grid">
          {bagSlots.map((item, index) => (
            <PixelItemCard key={item?.id || `slot-${index}`} item={item} fallbackDay={item?.sourceDay || Math.min(index + 1, 3)} />
          ))}
        </div>
      </RetroWindow>

      <RetroWindow title="本週收集" tone="yellow">
        <div className="window-stack-tight">
          {groupedByDay.map(({ day, items }) => (
            <div key={day} className="day-collection-row">
              <div className="day-collection-heading">
                <div className="window-mini-title">Day {day}</div>
                <PixelBadge tone={items.length > 0 ? "green" : "blue"}>{items.length > 0 ? "COLLECTED" : "LOCKED"}</PixelBadge>
              </div>
              <div className="day-collection-items">
                {items.length > 0 ? (
                  items.map((item) => (
                    <span key={item.id} className="day-collection-chip inline-flex items-center gap-2">
                      <PixelIcon type={getPartIconType(item.part)} size={16} />
                      {item.label || `${item.genre} ${item.part}`}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="day-collection-chip locked">?</span>
                    <span className="day-collection-chip locked inline-flex items-center justify-center">
                      <PixelIcon type="lock" size={16} />
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </RetroWindow>

      <RetroWindow title="裝備預覽" tone="green">
        <div className="equipment-preview">
          <PixelPetPreview title="Playlist Pet" subtitle="Ready to equip" />
          <div className="equipment-preview-panel">
            <div className="window-mini-title">裝備標籤</div>
            <div className="equipment-tag-list">
              {safeWeekItems.length > 0 ? (
                safeWeekItems.map((item) => (
                  <PixelBadge key={item.id} tone="default">
                    {item.label || `${item.genre} ${item.part}`}
                  </PixelBadge>
                ))
              ) : (
                <div className="window-hint">尚未收集到足夠的物品，先回到今日任務開始掉落吧！</div>
              )}
            </div>
            <Button variant="primary" className="w-full justify-center" onClick={() => navigateTo("today")}>
              OPEN BAG
            </Button>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
};
