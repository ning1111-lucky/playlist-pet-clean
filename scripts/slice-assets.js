import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sourceRoot = process.env.ASSET_SOURCE_DIR || path.join(os.homedir(), "Desktop", "design-referrence");
const outputRoot = path.join(repoRoot, "public", "assets");

const sheets = [
  {
    file: "asset-sheet-01.png",
    cols: 5,
    rows: 4,
    assets: [
      ["icons/cat-avatar.png", "pets/pink-cat-pet.png", "pets/blue-cat-pet.png", "pets/music-egg.png", "icons/pink-gem.png"],
      ["icons/gold-coin.png", "icons/music-note.png", "icons/star.png", "icons/heart.png", "items/gameboy.png"],
      ["icons/headphone.png", "icons/cassette-tape.png", "icons/menu-icon.png", "icons/plus-button.png", "icons/home-icon.png"],
      ["items/backpack.png", "map/map-icon.png", "icons/lock-icon.png", "icons/check-icon.png", "icons/sparkle-confetti-samples.png"],
    ],
  },
  {
    file: "asset-sheet-02.png",
    cols: 5,
    rows: 3,
    assets: [
      ["items/red-sneakers.png", "items/blue-jacket.png", "items/pink-headphones.png", "items/black-sunglasses.png", "items/gold-star-badge.png"],
      ["quest/map-ticket.png", "ui/retro-window-pink.png", "ui/retro-window-yellow.png", "ui/retro-window-green.png", "ui/xp-bar.png"],
      ["ui/progress-bar.png", "ui/start-button.png", "ui/open-bag-button.png", "ui/analyze-now-button.png", "ui/bottom-nav-sample.png"],
    ],
  },
  {
    file: "asset-sheet-03.png",
    cols: 5,
    rows: 3,
    assets: [
      ["map/pop-island.png", "map/kpop-island.png", "map/hiphop-island.png", "map/jazz-island.png", "map/country-island.png"],
      ["map/classical-island.png", "map/map-pin.png", "map/region-lock.png", "quest/day-1-badge.png", "quest/day-2-badge.png"],
      ["quest/day-3-badge.png", "quest/quest-card.png", "quest/reward-card.png", "quest/genre-bar-chart.png", "map/mini-world-map.png"],
    ],
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorDistance(r, g, b, target) {
  return Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2);
}

function isNeutralLight(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = (r + g + b) / 3;
  return brightness >= 205 && saturation <= 0.18;
}

function guessBackgroundColor(data, width, height) {
  const samples = [];

  const pushPixel = (x, y) => {
    const index = (y * width + x) * 4;
    samples.push({ r: data[index], g: data[index + 1], b: data[index + 2] });
  };

  for (let x = 0; x < width; x += 1) {
    pushPixel(x, 0);
    pushPixel(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    pushPixel(0, y);
    pushPixel(width - 1, y);
  }

  const neutralSamples = samples.filter((sample) => isNeutralLight(sample.r, sample.g, sample.b));
  const base = neutralSamples.length > 0 ? neutralSamples : samples;
  const total = base.reduce(
    (acc, sample) => ({
      r: acc.r + sample.r,
      g: acc.g + sample.g,
      b: acc.b + sample.b,
    }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: Math.round(total.r / base.length),
    g: Math.round(total.g / base.length),
    b: Math.round(total.b / base.length),
  };
}

function makeBackgroundMask(data, width, height) {
  const background = guessBackgroundColor(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const shouldRemove = (index) => {
    const pixelIndex = index * 4;
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const alpha = data[pixelIndex + 3];
    const distance = colorDistance(r, g, b, background);
    return alpha > 0 && (distance <= 44 || (distance <= 62 && isNeutralLight(r, g, b)));
  };

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (visited[index] || !shouldRemove(index)) {
      return;
    }
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  return visited;
}

function removeBackground(data, width, height) {
  const mask = makeBackgroundMask(data, width, height);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) {
      data[index * 4 + 3] = 0;
    }
  }
}

function findLabelBoundary(data, width, height) {
  const rowThreshold = Math.max(2, Math.floor(width * 0.015));
  const gapMin = Math.max(6, Math.floor(height * 0.03));
  const rowCounts = new Array(height).fill(0);

  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        count += 1;
      }
    }
    rowCounts[y] = count;
  }

  let cursor = height - 1;
  while (cursor >= 0 && rowCounts[cursor] < rowThreshold) {
    cursor -= 1;
  }
  if (cursor < 0) {
    return height;
  }

  while (cursor >= 0) {
    if (rowCounts[cursor] < rowThreshold) {
      let gapStart = cursor;
      while (gapStart >= 0 && rowCounts[gapStart] < rowThreshold) {
        gapStart -= 1;
      }
      const gapLength = cursor - gapStart;
      if (gapLength >= gapMin) {
        return clamp(gapStart + 1, 0, height);
      }
      cursor = gapStart;
      continue;
    }
    cursor -= 1;
  }

  return height;
}

function clearRows(data, width, startRow) {
  for (let y = startRow; y < data.length / 4 / width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

function trimBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { left: 0, top: 0, width, height };
  }

  const padding = 2;
  const left = clamp(minX - padding, 0, width - 1);
  const top = clamp(minY - padding, 0, height - 1);
  return {
    left,
    top,
    width: clamp(maxX - minX + 1 + padding * 2, 1, width - left),
    height: clamp(maxY - minY + 1 + padding * 2, 1, height - top),
  };
}

async function processCell(image, extractArea, outputPath) {
  const { data, info } = await image
    .clone()
    .extract(extractArea)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeBackground(data, info.width, info.height);

  const labelBoundary = findLabelBoundary(data, info.width, info.height);
  if (labelBoundary < info.height) {
    clearRows(data, info.width, labelBoundary);
  }

  const bounds = trimBounds(data, info.width, info.height);

  const outputBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .extract(bounds)
    .png()
    .toBuffer();

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, outputBuffer);
}

async function sliceSheet(sheet) {
  const sourcePath = path.join(sourceRoot, sheet.file);
  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read size for ${sheet.file}`);
  }

  for (let row = 0; row < sheet.rows; row += 1) {
    for (let col = 0; col < sheet.cols; col += 1) {
      const relativeOutput = sheet.assets[row]?.[col];
      if (!relativeOutput) {
        continue;
      }

      const left = Math.round((col * metadata.width) / sheet.cols);
      const top = Math.round((row * metadata.height) / sheet.rows);
      const right = Math.round(((col + 1) * metadata.width) / sheet.cols);
      const bottom = Math.round(((row + 1) * metadata.height) / sheet.rows);

      await processCell(
        image,
        {
          left,
          top,
          width: right - left,
          height: bottom - top,
        },
        path.join(outputRoot, relativeOutput),
      );

      console.log(`wrote ${relativeOutput}`);
    }
  }
}

async function main() {
  for (const sheet of sheets) {
    await sliceSheet(sheet);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
