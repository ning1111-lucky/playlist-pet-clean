import React from "react";
import { cn } from "../utils";
import { Genre, ItemPart, MusicItem } from "../types";
import { getAssetErrorFallback, resolveAssetImage } from "../assetMap";

export type PixelIconType =
  | "cat"
  | "egg"
  | "music-note"
  | "gem"
  | "coin"
  | "backpack"
  | "map"
  | "shoe"
  | "jacket"
  | "headphone"
  | "cassette"
  | "star"
  | "heart"
  | "lock"
  | "check"
  | "menu"
  | "plus"
  | "globe"
  | "microphone"
  | "ticket"
  | "sunglasses"
  | "spark"
  | "cap";

type PixelRect = {
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill: string;
};

const O = "#111111";
const W = "#ffffff";
const P = "#ff9dd6";
const Y = "#ffd84d";
const G = "#b7ff5e";
const B = "#2f7bff";
const LB = "#8ac6ff";
const PP = "#c9b8ff";
const C = "#f8f8f4";
const DG = "#3d4f6b";
const BR = "#8a5b33";
const GR = "#8f96a3";

const rect = (x: number, y: number, fill: string, w = 1, h = 1): PixelRect => ({ x, y, fill, w, h });

const iconRects: Record<PixelIconType, PixelRect[]> = {
  cat: [
    rect(4, 1, O, 2, 1), rect(10, 1, O, 2, 1),
    rect(3, 2, O, 1, 2), rect(6, 2, O, 1, 2), rect(9, 2, O, 1, 2), rect(12, 2, O, 1, 2),
    rect(4, 2, DG, 2, 1), rect(10, 2, DG, 2, 1),
    rect(4, 3, DG, 8, 1),
    rect(2, 4, O, 1, 6), rect(13, 4, O, 1, 6),
    rect(3, 4, DG, 10, 6),
    rect(5, 5, W, 2, 2), rect(9, 5, W, 2, 2),
    rect(5, 6, O, 1, 1), rect(10, 6, O, 1, 1),
    rect(6, 7, P, 1, 1), rect(9, 7, P, 1, 1),
    rect(7, 7, O, 2, 1), rect(7, 8, P, 2, 1),
    rect(3, 10, O, 10, 1), rect(4, 11, O, 8, 1),
  ],
  egg: [
    rect(6, 1, O, 4, 1), rect(4, 2, O, 2, 1), rect(10, 2, O, 2, 1),
    rect(3, 3, O, 1, 2), rect(12, 3, O, 1, 2),
    rect(2, 5, O, 1, 5), rect(13, 5, O, 1, 5),
    rect(3, 10, O, 1, 2), rect(12, 10, O, 1, 2),
    rect(4, 12, O, 2, 1), rect(10, 12, O, 2, 1),
    rect(6, 13, O, 4, 1),
    rect(4, 3, C, 8, 9), rect(3, 5, C, 10, 5), rect(5, 12, C, 6, 1),
    rect(7, 4, P, 2, 2), rect(6, 6, P, 4, 1),
  ],
  "music-note": [
    rect(9, 1, O, 2, 1), rect(9, 2, O, 2, 1), rect(9, 3, O, 2, 1), rect(9, 4, O, 2, 1), rect(9, 5, O, 2, 1),
    rect(10, 1, LB, 3, 2), rect(10, 2, LB, 3, 1),
    rect(5, 8, O, 3, 1), rect(4, 9, O, 1, 2), rect(8, 9, O, 1, 2), rect(5, 11, O, 3, 1),
    rect(4, 10, LB, 4, 1), rect(10, 6, O, 3, 1), rect(9, 7, O, 1, 2), rect(13, 7, O, 1, 2), rect(10, 9, O, 3, 1),
    rect(9, 8, PP, 4, 1),
  ],
  gem: [
    rect(6, 1, O, 4, 1), rect(4, 2, O, 2, 1), rect(10, 2, O, 2, 1),
    rect(3, 3, O, 1, 2), rect(12, 3, O, 1, 2),
    rect(4, 5, O, 1, 2), rect(11, 5, O, 1, 2),
    rect(5, 7, O, 1, 2), rect(10, 7, O, 1, 2),
    rect(6, 9, O, 1, 2), rect(9, 9, O, 1, 2),
    rect(7, 11, O, 2, 1),
    rect(5, 2, P, 6, 2), rect(4, 4, P, 8, 2), rect(5, 6, PP, 6, 2), rect(6, 8, P, 4, 2), rect(7, 10, PP, 2, 1),
    rect(9, 3, W, 1, 2), rect(8, 4, W, 1, 1),
  ],
  coin: [
    rect(4, 2, O, 8, 1), rect(3, 3, O, 1, 8), rect(12, 3, O, 1, 8), rect(4, 11, O, 8, 1),
    rect(4, 3, Y, 8, 8), rect(6, 5, O, 1, 4), rect(8, 4, O, 1, 6), rect(9, 4, O, 1, 1), rect(9, 7, O, 1, 1), rect(9, 9, O, 1, 1),
  ],
  backpack: [
    rect(5, 1, O, 6, 1), rect(4, 2, O, 1, 2), rect(11, 2, O, 1, 2),
    rect(3, 4, O, 1, 8), rect(12, 4, O, 1, 8), rect(4, 12, O, 8, 1),
    rect(4, 4, G, 8, 8), rect(6, 3, G, 4, 1), rect(6, 5, O, 4, 1), rect(6, 6, GR, 4, 4), rect(7, 7, O, 2, 2),
    rect(2, 5, O, 1, 4), rect(13, 5, O, 1, 4), rect(2, 6, G, 1, 2), rect(13, 6, G, 1, 2),
  ],
  map: [
    rect(2, 3, O, 4, 1), rect(2, 4, O, 1, 8), rect(5, 4, O, 1, 8),
    rect(7, 2, O, 4, 1), rect(7, 3, O, 1, 8), rect(10, 3, O, 1, 8),
    rect(12, 3, O, 2, 1), rect(12, 4, O, 1, 8), rect(15, 4, O, 1, 8),
    rect(3, 4, LB, 2, 7), rect(8, 3, G, 2, 7), rect(13, 4, Y, 2, 7),
    rect(4, 6, O, 1, 1), rect(8, 5, O, 1, 1), rect(14, 8, O, 1, 1),
  ],
  shoe: [
    rect(2, 9, O, 7, 1), rect(1, 10, O, 1, 2), rect(9, 10, O, 1, 2), rect(2, 12, O, 9, 1),
    rect(2, 8, P, 5, 1), rect(2, 9, P, 6, 2), rect(3, 11, P, 4, 1),
    rect(6, 7, O, 3, 1), rect(7, 8, O, 1, 1), rect(8, 8, W, 3, 3), rect(10, 11, O, 4, 1), rect(11, 9, O, 1, 2),
    rect(9, 11, Y, 1, 1), rect(4, 9, W, 2, 1), rect(8, 9, W, 2, 1),
  ],
  jacket: [
    rect(2, 3, O, 4, 1), rect(10, 3, O, 4, 1), rect(1, 4, O, 1, 6), rect(14, 4, O, 1, 6),
    rect(2, 10, O, 4, 1), rect(10, 10, O, 4, 1), rect(6, 4, O, 1, 7), rect(9, 4, O, 1, 7),
    rect(2, 4, B, 4, 6), rect(10, 4, B, 4, 6), rect(7, 4, C, 2, 7),
    rect(3, 5, PP, 2, 1), rect(11, 5, PP, 2, 1), rect(7, 6, O, 2, 1), rect(7, 8, Y, 2, 1),
  ],
  headphone: [
    rect(4, 2, O, 8, 1), rect(3, 3, O, 1, 4), rect(12, 3, O, 1, 4),
    rect(4, 3, PP, 8, 3), rect(2, 7, O, 2, 4), rect(12, 7, O, 2, 4),
    rect(3, 8, DG, 2, 3), rect(11, 8, DG, 2, 3), rect(5, 4, B, 2, 1), rect(9, 4, B, 2, 1),
  ],
  cassette: [
    rect(2, 3, O, 12, 1), rect(1, 4, O, 1, 8), rect(14, 4, O, 1, 8), rect(2, 12, O, 12, 1),
    rect(2, 4, DG, 12, 8), rect(4, 6, O, 3, 3), rect(9, 6, O, 3, 3), rect(5, 7, GR, 1, 1), rect(10, 7, GR, 1, 1),
    rect(7, 6, O, 2, 3), rect(7, 7, P, 2, 1), rect(4, 10, O, 8, 1), rect(5, 5, PP, 6, 1),
  ],
  star: [
    rect(7, 1, O, 2, 1), rect(7, 2, Y, 2, 2), rect(4, 4, Y, 8, 2), rect(6, 6, Y, 4, 2), rect(5, 8, Y, 2, 2), rect(9, 8, Y, 2, 2),
    rect(6, 10, Y, 1, 2), rect(9, 10, Y, 1, 2),
    rect(4, 4, O, 1, 1), rect(11, 4, O, 1, 1), rect(6, 11, O, 1, 1), rect(9, 11, O, 1, 1),
  ],
  heart: [
    rect(4, 2, O, 3, 1), rect(9, 2, O, 3, 1), rect(3, 3, O, 1, 3), rect(7, 3, O, 1, 3), rect(8, 3, O, 1, 3), rect(12, 3, O, 1, 3),
    rect(4, 3, P, 3, 3), rect(9, 3, P, 3, 3), rect(4, 6, P, 8, 2), rect(5, 8, P, 6, 2), rect(6, 10, P, 4, 2), rect(7, 12, P, 2, 1),
  ],
  lock: [
    rect(5, 2, O, 6, 1), rect(4, 3, O, 1, 4), rect(11, 3, O, 1, 4), rect(5, 7, O, 6, 1),
    rect(3, 8, O, 10, 1), rect(2, 9, O, 1, 5), rect(13, 9, O, 1, 5), rect(3, 14, O, 10, 1),
    rect(3, 9, Y, 10, 5), rect(7, 10, O, 2, 3), rect(8, 12, O, 1, 1),
  ],
  check: [
    rect(2, 8, O, 2, 2), rect(4, 10, O, 2, 2), rect(6, 8, O, 2, 2), rect(8, 6, O, 2, 2), rect(10, 4, O, 2, 2), rect(12, 2, O, 2, 2),
    rect(2, 9, G, 2, 1), rect(4, 11, G, 2, 1), rect(6, 9, G, 2, 1), rect(8, 7, G, 2, 1), rect(10, 5, G, 2, 1), rect(12, 3, G, 2, 1),
  ],
  menu: [
    rect(3, 4, O, 10, 2), rect(3, 7, O, 10, 2), rect(3, 10, O, 10, 2),
  ],
  plus: [
    rect(7, 3, O, 2, 10), rect(3, 7, O, 10, 2), rect(7, 3, Y, 2, 10), rect(3, 7, Y, 10, 2),
  ],
  globe: [
    rect(5, 2, O, 6, 1), rect(3, 3, O, 2, 1), rect(11, 3, O, 2, 1), rect(2, 5, O, 1, 6), rect(13, 5, O, 1, 6), rect(5, 11, O, 6, 1), rect(3, 10, O, 2, 1), rect(11, 10, O, 2, 1),
    rect(4, 4, B, 8, 7), rect(7, 4, O, 1, 7), rect(8, 4, O, 1, 7), rect(4, 6, O, 8, 1), rect(4, 8, O, 8, 1),
  ],
  microphone: [
    rect(6, 2, O, 4, 1), rect(5, 3, O, 1, 5), rect(10, 3, O, 1, 5), rect(6, 8, O, 4, 1),
    rect(6, 3, P, 4, 5), rect(7, 9, O, 2, 3), rect(5, 12, O, 6, 1), rect(10, 10, O, 3, 1), rect(12, 11, O, 1, 3), rect(13, 14, O, 2, 1),
    rect(6, 4, W, 1, 1), rect(8, 5, W, 1, 1),
  ],
  ticket: [
    rect(2, 4, O, 12, 1), rect(1, 5, O, 1, 6), rect(14, 5, O, 1, 6), rect(2, 11, O, 12, 1),
    rect(2, 5, C, 12, 6), rect(5, 5, O, 1, 6), rect(10, 5, O, 1, 6), rect(6, 7, Y, 3, 2), rect(11, 7, P, 2, 2),
  ],
  sunglasses: [
    rect(2, 5, O, 5, 1), rect(9, 5, O, 5, 1), rect(2, 6, O, 1, 3), rect(6, 6, O, 1, 3), rect(9, 6, O, 1, 3), rect(13, 6, O, 1, 3),
    rect(3, 6, DG, 3, 3), rect(10, 6, DG, 3, 3), rect(7, 6, O, 2, 1),
  ],
  spark: [
    rect(7, 1, O, 2, 2), rect(6, 3, O, 4, 2), rect(4, 5, O, 8, 2), rect(6, 7, O, 4, 2), rect(7, 9, O, 2, 2),
    rect(7, 2, Y, 2, 1), rect(6, 3, Y, 4, 1), rect(5, 5, Y, 6, 1), rect(6, 7, Y, 4, 1), rect(7, 9, Y, 2, 1),
  ],
  cap: [
    rect(4, 4, O, 7, 1), rect(3, 5, O, 1, 3), rect(11, 5, O, 1, 3), rect(4, 8, O, 7, 1), rect(2, 8, O, 2, 1), rect(11, 8, O, 3, 1),
    rect(4, 5, PP, 7, 3), rect(3, 8, PP, 9, 1), rect(10, 6, Y, 1, 1),
  ],
};

export const PixelIcon = ({
  type,
  size = 20,
  className,
}: {
  type: PixelIconType;
  size?: number;
  className?: string;
}) => {
  const shapes = iconRects[type] || iconRects.star;

  return (
    <svg
      className={cn("pixel-svg-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {shapes.map((shape, index) => (
        <rect
          key={`${type}-${index}`}
          x={shape.x}
          y={shape.y}
          width={shape.w || 1}
          height={shape.h || 1}
          fill={shape.fill}
        />
      ))}
    </svg>
  );
};

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "pink" | "blue" }>(({ className, variant = "primary", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "pixel-button type-button select-none text-center",
        variant === "primary" && "pixel-button-primary",
        variant === "secondary" && "pixel-button-secondary",
        variant === "pink" && "pixel-button-pink",
        variant === "blue" && "pixel-button-blue",
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";
export const PixelButton = Button;

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn("pixel-card", className)}>{children}</div>;
};
export const PixelCard = Card;

export const PixelBadge = ({ children, className, tone = "default" }: { children: React.ReactNode; className?: string; tone?: "default" | "green" | "pink" | "yellow" | "blue" }) => (
  <span className={cn("info-chip", `info-chip-${tone}`, className)}>{children}</span>
);

export const PixelSectionTitle = ({
  eyebrow,
  title,
  subtitle,
  className,
  variant = "light",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  variant?: "light" | "dark";
}) => (
  <div className={cn("page-title-group", className)}>
    {eyebrow ? <div className={cn("type-caption uppercase tracking-[0.18em]", variant === "light" ? "text-white/90" : "text-[var(--color-muted)]")}>{eyebrow}</div> : null}
    <h2 className={cn(variant === "light" ? "page-title" : "type-h2 text-[var(--color-text)]")}>{title}</h2>
    {subtitle ? <p className={cn(variant === "light" ? "page-subtitle" : "type-body text-[var(--color-muted)]")}>{subtitle}</p> : null}
  </div>
);

export const PixelProgressBar = ({
  segments,
}: {
  segments: Array<{ label: string; percentage: number; color: string }>;
}) => (
  <div className="pixel-progress">
    <div className="flex h-full overflow-hidden rounded-[999px]">
      {segments.map((segment, index) => (
        <div
          key={`${segment.label}-${index}`}
          className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-[8px] font-black text-[var(--color-text)]"
          style={{ width: `${segment.percentage}%`, backgroundColor: segment.color }}
        >
          {segment.percentage > 12 ? segment.label : ""}
        </div>
      ))}
    </div>
  </div>
);

export const PixelStatusBar = ({ gems = 120, level = 1, progress = 32 }: { gems?: number; level?: number; progress?: number }) => (
  <div className="pixel-status-bar">
    <div className="pixel-status-left">
      <div className="pixel-avatar-box"><PixelIcon type="cat" size={24} /></div>
      <div className="pixel-level-stack">
        <div className="pixel-level-label">LV.{String(level).padStart(2, "0")}</div>
        <div className="pixel-mini-progress">
          <span style={{ width: `${Math.max(12, Math.min(100, progress))}%` }} />
        </div>
      </div>
    </div>
    <div className="pixel-status-right">
      <div className="pixel-gem-chip"><PixelIcon type="gem" size={16} /> {gems}</div>
      <button type="button" className="pixel-icon-btn" aria-label="add gems"><PixelIcon type="plus" size={16} /></button>
      <button type="button" className="pixel-icon-btn" aria-label="menu"><PixelIcon type="menu" size={16} /></button>
    </div>
  </div>
);

export const PixelLogoTitle = ({ title, subtitle, kicker, className }: { title: string; subtitle?: string; kicker?: string; className?: string }) => (
  <div className={cn("pixel-logo-title", className)}>
    {kicker ? <div className="pixel-logo-kicker">{kicker}</div> : null}
    <div className="pixel-logo-main">{title}</div>
    {subtitle ? <div className="pixel-logo-subtitle">{subtitle}</div> : null}
  </div>
);

export const WindowTitleBar = ({ title, tone = "pink", children }: { title: string; tone?: "pink" | "yellow" | "green" | "blue"; children?: React.ReactNode }) => (
  <div className={cn("retro-window-titlebar", `tone-${tone}`)}>
    <span>{title}</span>
    <div className="retro-window-controls">{children ?? <><i /> <i /> <i /></>}</div>
  </div>
);

export const RetroWindow = ({ title, tone = "pink", className, children, bodyClassName }: { title: string; tone?: "pink" | "yellow" | "green" | "blue"; className?: string; bodyClassName?: string; children: React.ReactNode }) => (
  <section className={cn("retro-window", className)}>
    <WindowTitleBar title={title} tone={tone} />
    <div className={cn("retro-window-body", bodyClassName)}>{children}</div>
  </section>
);

export const PixelProgress = ({ label, value, max, color = "var(--color-primary)" }: { label?: string; value: number; max: number; color?: string }) => {
  const safeMax = Math.max(1, max);
  const percentage = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div className="pixel-progress-stack">
      {label ? <div className="pixel-progress-label">{label}</div> : null}
      <div className="pixel-progress-large">
        <span style={{ width: `${percentage}%`, background: color }} />
      </div>
      <div className="pixel-progress-value">{value} / {max}</div>
    </div>
  );
};

export const getGenreIconType = (genre: Genre): PixelIconType => {
  const map: Record<Genre | string, PixelIconType> = {
    Pop: "microphone",
    "Hip-hop": "cassette",
    Hiphop: "cassette",
    "K-pop": "heart",
    Kpop: "heart",
    EDM: "spark",
    Classical: "music-note",
    Jazz: "music-note",
    "R&B": "headphone",
    RnB: "headphone",
    Country: "map",
    Rock: "cassette",
    "Taiwan Indie": "backpack",
    Indie: "backpack",
    Mixed: "spark",
    Hidden: "star",
  };
  return map[genre] || "music-note";
};

export const getPartIconType = (part: ItemPart): PixelIconType => {
  const map: Record<ItemPart | string, PixelIconType> = {
    clothes: "jacket",
    headwear: "cap",
    accessory: "heart",
    handheld: "microphone",
    shoes: "shoe",
    enhance: "spark",
    "final weekly pet": "egg",
  };
  return map[part] || "ticket";
};

export const PixelItemPlaceholder: React.FC<{
  genre: Genre;
  part: ItemPart;
  label?: string;
  imageSrc?: string | null;
  className?: string;
}> = ({ genre, part, label, imageSrc, className }) => {
  const imagePath: string | null = imageSrc || resolveAssetImage(genre, part, `${genre}-${part}`) || null;
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imagePath]);

  return (
    <div className={cn("flex flex-col items-center justify-center p-2 bg-[var(--color-card-secondary)] border border-[rgba(17,17,17,0.08)] rounded-[18px] overflow-hidden relative group", className)}>
      {imagePath && !imageFailed ? (
        <div className="flex flex-col items-center">
          <img
            src={imagePath}
            alt={`${genre} ${part}`}
            className="w-16 h-16 object-contain"
            style={{ imageRendering: "pixelated" }}
            onError={(event) => {
              const fallback = getAssetErrorFallback(genre, part, imagePath, `${genre}-${part}`);
              if (fallback && fallback !== imagePath) {
                (event.currentTarget as HTMLImageElement).src = fallback;
                return;
              }
              setImageFailed(true);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <PixelIcon type={getPartIconType(part)} size={44} />
            <span className="absolute bottom-[-6px] right-[-6px] rounded-full border-2 border-[var(--color-black)] bg-white p-1">
              <PixelIcon type={getGenreIconType(genre)} size={16} />
            </span>
          </div>
          <div className="type-caption mt-2 text-center text-red-500">缺少素材：{genre} {part}</div>
        </div>
      )}
      {label && <div className="type-caption mt-2 text-center leading-tight truncate">{label}</div>}
    </div>
  );
};

export const PixelItemCard = ({ item, fallbackDay, className }: { item?: MusicItem | null; fallbackDay?: number; className?: string }) => {
  if (!item) {
    return (
      <div className={cn("pixel-item-card opacity-70", className)}>
        <div className="pixel-item-thumb flex items-center justify-center"><PixelIcon type="lock" size={36} /></div>
        <div className="pixel-item-name">未解鎖</div>
        <div className="pixel-item-stars">
          <PixelIcon type="star" size={14} />
          <PixelIcon type="star" size={14} />
          <PixelIcon type="star" size={14} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("pixel-item-card", className)}>
      <div className="pixel-item-day">D{item.sourceDay || fallbackDay || 1}</div>
      <div className="pixel-item-thumb">
        <PixelItemPlaceholder genre={item.genre} part={item.part} imageSrc={item.imageSrc} className="w-full h-full border-none shadow-none bg-transparent" />
      </div>
      <div className="pixel-item-name">{item.label || `${item.genre} ${item.part}`}</div>
      <div className="pixel-item-stars">
        <PixelIcon type="star" size={14} />
        <PixelIcon type="star" size={14} />
        <PixelIcon type="star" size={14} />
      </div>
    </div>
  );
};

export const PixelPetPreview = ({ imageSrc, title, subtitle, className }: { imageSrc?: string | null; title?: string; subtitle?: string; className?: string }) => (
  <div className={cn("pixel-pet-preview", className)}>
    <div className="pixel-pet-preview-frame">
      {imageSrc ? <img src={imageSrc} alt={title || "pet"} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} /> : <img src="/base-1.png" alt="pet base" className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />}
    </div>
    {title ? <div className="pixel-pet-preview-title">{title}</div> : null}
    {subtitle ? <div className="pixel-pet-preview-subtitle">{subtitle}</div> : null}
  </div>
);

export const PixelMap = ({ children }: { children: React.ReactNode }) => <div className="pixel-map-surface">{children}</div>;

export const PetPlaceholder: React.FC<{
  baseType: "O" | "G" | "B";
  className?: string;
}> = ({ baseType, className }) => {
  let shapeClass = "";
  if (baseType === "O") shapeClass = "rounded-full w-24 h-24";
  if (baseType === "G") shapeClass = "rounded-t-full rounded-b-xl w-20 h-28";
  if (baseType === "B") shapeClass = "rounded-xl w-24 h-24";

  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <div className={cn("bg-white border border-[rgba(17,17,17,0.08)] relative shadow-inner overflow-hidden flex items-center justify-center", shapeClass)}>
        <div className="absolute top-[35%] flex w-full justify-center space-x-6">
          <div className="w-2 h-2 bg-[var(--color-text)] rounded-full"></div>
          <div className="w-2 h-2 bg-[var(--color-text)] rounded-full"></div>
        </div>
        <div className="absolute top-[45%] flex w-full justify-center space-x-8 opacity-60">
          <div className="w-3 h-1.5 bg-[var(--color-pink)] rounded-full"></div>
          <div className="w-3 h-1.5 bg-[var(--color-pink)] rounded-full"></div>
        </div>
        <div className="absolute top-[45%] w-3 h-2 border-b-2 border-r-2 border-[var(--color-text)] rounded-br-full transform rotate-45"></div>
      </div>
    </div>
  );
};
