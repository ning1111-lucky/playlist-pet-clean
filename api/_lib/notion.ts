type NotionSearchResult = {
  id?: unknown;
  object?: unknown;
  title?: unknown;
};

type NotionQueryResult = {
  id?: unknown;
  properties?: unknown;
};

type NotionDatabaseDetails = {
  id?: unknown;
  title?: unknown;
  properties?: unknown;
};

export type NotionGenreRule = {
  id: string;
  displayName: string;
  genreKey: string;
  promptHint: string;
  visualKeywords: string[];
  colorTheme: string;
  itemStyleNotes: string;
  baseFitNotes: string;
  quotePool: string;
  mapRegion: string;
  isActive: boolean;
  sortOrder: number;
};

export type NotionGenreReferenceContext = {
  mainRule: NotionGenreRule | null;
  subRule: NotionGenreRule | null;
  promptContext: string;
  source: {
    object: "database" | "data_source";
    id: string;
    title: string;
  } | null;
};

export type NotionUserSyncInput = {
  name: string;
  email: string;
  musicSource: string;
  lastfmUsername?: string;
  spotifyConnected: boolean;
  country: string;
  city: string;
  styleNote?: string;
};

export type NotionWeeklyRunInput = {
  sessionName: string;
  userName: string;
  musicSource: string;
  lastfmUsername?: string;
  mainGenreKey: string;
  secondaryGenreKey: string;
  analysisType: string;
  listenCount: number;
  day1ClothesKey: string;
  day1ShoesKey: string;
  day2HeadwearKey: string;
  day2HandheldKey: string;
  day3AccessoryKey: string;
  baseKey: string;
  finalPrompt: string;
  petImageUrl: string;
  status: string;
};

type NotionDatabaseSource = {
  id: string;
  title: string;
};

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const DEFAULT_DB_NAME = "Genre Rules";
const DEFAULT_USERS_DB_NAME = "users";
const DEFAULT_WEEKLY_RUNS_DB_NAME = "weekly-runs";

function createHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function normalizeGenreKey(value: string): string {
  const trimmed = value.trim();
  const map: Record<string, string> = {
    "K-pop": "Kpop",
    Kpop: "Kpop",
    kpop: "Kpop",
    KPOP: "Kpop",
    "R&B": "RnB",
    RnB: "RnB",
    rnb: "RnB",
    RNB: "RnB",
    "Hip-hop": "Hiphop",
    Hiphop: "Hiphop",
    hiphop: "Hiphop",
    HIPHOP: "Hiphop",
    Indie: "Indie",
    indie: "Indie",
    INDIE: "Indie",
    "Taiwan Indie": "Indie",
    Pop: "Pop",
    pop: "Pop",
    POP: "Pop",
    Country: "Country",
    country: "Country",
    COUNTRY: "Country",
    Classical: "Classical",
    classical: "Classical",
    CLASSICAL: "Classical",
    Jazz: "Jazz",
    jazz: "Jazz",
    JAZZ: "Jazz",
    EDM: "EDM",
    edm: "EDM",
  };

  return map[trimmed] || trimmed;
}

async function notionRequest<T>(token: string, pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE}${pathname}`, {
    ...init,
    headers: {
      ...createHeaders(token),
      ...(init?.headers || {}),
    },
  });

  const rawText = await response.text().catch(() => "");
  let parsed: unknown = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && typeof (parsed as { message?: unknown }).message === "string"
        ? ((parsed as { message: string }).message || "").trim()
        : rawText.trim();
    throw new Error(message || `Notion request failed: ${response.status}`);
  }

  return parsed as T;
}

function plainTextFromRichItems(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      return typeof record.plain_text === "string" ? record.plain_text : "";
    })
    .join("")
    .trim();
}

function plainTitle(value: unknown): string {
  return plainTextFromRichItems(value);
}

function propertyToString(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const property = value as Record<string, unknown>;
  const type = typeof property.type === "string" ? property.type : "";

  switch (type) {
    case "title":
      return plainTitle(property.title);
    case "rich_text":
      return plainTextFromRichItems(property.rich_text);
    case "select":
      return property.select && typeof property.select === "object" && typeof (property.select as Record<string, unknown>).name === "string"
        ? ((property.select as Record<string, string>).name || "").trim()
        : "";
    case "status":
      return property.status && typeof property.status === "object" && typeof (property.status as Record<string, unknown>).name === "string"
        ? ((property.status as Record<string, string>).name || "").trim()
        : "";
    case "multi_select":
      return Array.isArray(property.multi_select)
        ? property.multi_select
            .map((item) => (item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string" ? (item as Record<string, string>).name : ""))
            .filter(Boolean)
            .join(";")
        : "";
    case "number":
      return Number.isFinite(Number(property.number)) ? String(Number(property.number)) : "";
    case "checkbox":
      return property.checkbox === true ? "true" : property.checkbox === false ? "false" : "";
    case "url":
      return typeof property.url === "string" ? property.url.trim() : "";
    case "email":
      return typeof property.email === "string" ? property.email.trim() : "";
    default:
      return "";
  }
}

function propertyToBoolean(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const property = value as Record<string, unknown>;
  if (property.type === "checkbox") return property.checkbox === true;
  return propertyToString(value).toLowerCase() === "true";
}

function propertyToNumber(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const property = value as Record<string, unknown>;
  if (property.type === "number") return Number(property.number) || 0;
  return Number(propertyToString(value)) || 0;
}

function propertyToMultiSelect(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const property = value as Record<string, unknown>;
  if (property.type === "multi_select" && Array.isArray(property.multi_select)) {
    return property.multi_select
      .map((item) => (item && typeof item === "object" && typeof (item as Record<string, unknown>).name === "string" ? ((item as Record<string, string>).name || "").trim() : ""))
      .filter(Boolean);
  }

  return propertyToString(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSearchTitle(result: NotionSearchResult): string {
  return plainTitle(result.title);
}

function getNotionToken(): string {
  const token = (process.env.NOTION_ACCESS_TOKEN || process.env.NOTION_API_KEY || "").trim();
  if (!token) {
    throw new Error("Missing NOTION_ACCESS_TOKEN");
  }

  return token;
}

function normalizeNotionName(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

async function searchDatabaseByName(
  token: string,
  name: string,
  explicitDatabaseId: string
): Promise<NotionDatabaseSource> {
  if (explicitDatabaseId.trim()) {
    return {
      id: explicitDatabaseId.trim(),
      title: name,
    };
  }

  const searchResponse = await notionRequest<{ results?: NotionSearchResult[] }>(token, "/search", {
    method: "POST",
    body: JSON.stringify({
      query: name,
      filter: {
        property: "object",
        value: "database",
      },
    }),
  });

  const results = Array.isArray(searchResponse.results) ? searchResponse.results : [];
  const exactMatch =
    results.find((result) => normalizeNotionName(extractSearchTitle(result)) === normalizeNotionName(name)) ||
    results.find((result) => extractSearchTitle(result).toLowerCase() === name.toLowerCase()) ||
    results[0];

  if (!exactMatch || typeof exactMatch.id !== "string" || !exactMatch.id) {
    throw new Error(`No accessible Notion database found for "${name}". Share the database with your integration or set an explicit database ID.`);
  }

  return {
    id: exactMatch.id,
    title: extractSearchTitle(exactMatch) || name,
  };
}

async function getDatabaseDetails(token: string, databaseId: string): Promise<NotionDatabaseDetails> {
  return notionRequest<NotionDatabaseDetails>(token, `/databases/${databaseId}`);
}

async function queryDatabasePages(token: string, databaseId: string): Promise<NotionQueryResult[]> {
  const response = await notionRequest<{ results?: NotionQueryResult[] }>(token, `/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 100,
    }),
  });

  return Array.isArray(response.results) ? response.results : [];
}

function toRichText(value: string) {
  return value ? [{ type: "text", text: { content: value.slice(0, 1900) } }] : [];
}

function buildPropertyPayload(
  schema: Record<string, unknown>,
  values: Record<string, string | number | boolean | undefined>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const [name, rawValue] of Object.entries(values)) {
    if (!(name in schema) || rawValue === undefined) continue;

    const definition = schema[name];
    if (!definition || typeof definition !== "object") continue;
    const type = typeof (definition as Record<string, unknown>).type === "string" ? ((definition as Record<string, string>).type || "") : "";

    switch (type) {
      case "title":
        properties[name] = { title: toRichText(String(rawValue)) };
        break;
      case "rich_text":
        properties[name] = { rich_text: toRichText(String(rawValue)) };
        break;
      case "email":
        properties[name] = { email: String(rawValue || "") || null };
        break;
      case "checkbox":
        properties[name] = { checkbox: Boolean(rawValue) };
        break;
      case "number":
        properties[name] = { number: Number(rawValue) || 0 };
        break;
      case "select":
        properties[name] = String(rawValue).trim() ? { select: { name: String(rawValue).trim() } } : { select: null };
        break;
      case "status":
        properties[name] = String(rawValue).trim() ? { status: { name: String(rawValue).trim() } } : { status: null };
        break;
      case "url":
        properties[name] = { url: String(rawValue || "") || null };
        break;
      case "multi_select":
        properties[name] = {
          multi_select: String(rawValue)
            .split(/[;,]/)
            .map((item) => item.trim())
            .filter(Boolean)
            .map((name) => ({ name })),
        };
        break;
      default:
        break;
    }
  }

  return properties;
}

async function createPageInDatabase(
  token: string,
  databaseId: string,
  properties: Record<string, unknown>
): Promise<{ id?: unknown }> {
  return notionRequest<{ id?: unknown }>(token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });
}

async function updatePageProperties(
  token: string,
  pageId: string,
  properties: Record<string, unknown>
): Promise<{ id?: unknown }> {
  return notionRequest<{ id?: unknown }>(token, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties,
    }),
  });
}

async function discoverReferenceContainer(token: string) {
  const explicitDataSourceId = (process.env.NOTION_DATA_SOURCE_ID || "").trim();
  if (explicitDataSourceId) {
    return {
      object: "data_source" as const,
      id: explicitDataSourceId,
      title: process.env.NOTION_GENRE_DB_NAME || DEFAULT_DB_NAME,
    };
  }

  const explicitDatabaseId = (process.env.NOTION_DATABASE_ID || "").trim();
  if (explicitDatabaseId) {
    return {
      object: "database" as const,
      id: explicitDatabaseId,
      title: process.env.NOTION_GENRE_DB_NAME || DEFAULT_DB_NAME,
    };
  }

  const dbName = (process.env.NOTION_GENRE_DB_NAME || DEFAULT_DB_NAME).trim();
  const searchResponse = await notionRequest<{ results?: NotionSearchResult[] }>(token, "/search", {
    method: "POST",
    body: JSON.stringify({
      query: dbName,
      filter: {
        property: "object",
        value: "database",
      },
    }),
  });

  const results = Array.isArray(searchResponse.results) ? searchResponse.results : [];
  const exactMatch =
    results.find((result) => normalizeGenreKey(extractSearchTitle(result)) === normalizeGenreKey(dbName)) ||
    results.find((result) => extractSearchTitle(result).toLowerCase() === dbName.toLowerCase()) ||
    results[0];

  if (!exactMatch || typeof exactMatch.id !== "string" || !exactMatch.id) {
    throw new Error(`No accessible Notion database found for "${dbName}". Share the database with your integration or set NOTION_DATABASE_ID.`);
  }

  return {
    object: "database" as const,
    id: exactMatch.id,
    title: extractSearchTitle(exactMatch) || dbName,
  };
}

async function queryGenreRulePages(token: string, source: { object: "database" | "data_source"; id: string }) {
  const pathname =
    source.object === "data_source" ? `/data_sources/${source.id}/query` : `/databases/${source.id}/query`;

  const response = await notionRequest<{ results?: NotionQueryResult[] }>(token, pathname, {
    method: "POST",
    body: JSON.stringify({
      page_size: 100,
    }),
  });

  return Array.isArray(response.results) ? response.results : [];
}

function normalizeGenreRule(page: NotionQueryResult): NotionGenreRule | null {
  const id = typeof page.id === "string" ? page.id : "";
  const properties = page.properties && typeof page.properties === "object" ? (page.properties as Record<string, unknown>) : null;
  if (!id || !properties) return null;

  const displayName = propertyToString(properties.display_name);
  const genreKey = normalizeGenreKey(propertyToString(properties.genre_key));
  if (!displayName || !genreKey) return null;

  return {
    id,
    displayName,
    genreKey,
    promptHint: propertyToString(properties.prompt_hint),
    visualKeywords: propertyToMultiSelect(properties.visual_keywords),
    colorTheme: propertyToString(properties.color_theme),
    itemStyleNotes: propertyToString(properties.item_style_notes),
    baseFitNotes: propertyToString(properties.base_fit_notes),
    quotePool: propertyToString(properties.quote_pool),
    mapRegion: propertyToString(properties.map_region),
    isActive: propertyToBoolean(properties.is_active),
    sortOrder: propertyToNumber(properties.sort_order),
  };
}

export async function getGenreRules(): Promise<{ rules: NotionGenreRule[]; source: NotionGenreReferenceContext["source"] }> {
  const token = getNotionToken();

  const source = await discoverReferenceContainer(token);
  const pages = await queryGenreRulePages(token, source);
  const rules = pages
    .map((page) => normalizeGenreRule(page))
    .filter((rule): rule is NotionGenreRule => Boolean(rule))
    .filter((rule) => rule.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));

  return {
    rules,
    source,
  };
}

export async function buildGenreReferenceContext(mainGenre: string, subGenre: string): Promise<NotionGenreReferenceContext> {
  const { rules, source } = await getGenreRules();
  const mainKey = normalizeGenreKey(mainGenre);
  const subKey = normalizeGenreKey(subGenre);

  const mainRule = rules.find((rule) => normalizeGenreKey(rule.genreKey) === mainKey) || null;
  const subRule = rules.find((rule) => normalizeGenreKey(rule.genreKey) === subKey) || null;

  const segments: string[] = [];

  if (mainRule) {
    segments.push(
      `Main genre reference (${mainRule.displayName}): prompt hint ${mainRule.promptHint || "none"}; visual keywords ${mainRule.visualKeywords.join(", ") || "none"}; color theme ${mainRule.colorTheme || "none"}; item notes ${mainRule.itemStyleNotes || "none"}; base fit notes ${mainRule.baseFitNotes || "none"}.`
    );
  }

  if (subRule && subRule.id !== mainRule?.id) {
    segments.push(
      `Secondary genre reference (${subRule.displayName}): prompt hint ${subRule.promptHint || "none"}; visual keywords ${subRule.visualKeywords.join(", ") || "none"}; color theme ${subRule.colorTheme || "none"}; item notes ${subRule.itemStyleNotes || "none"}; base fit notes ${subRule.baseFitNotes || "none"}.`
    );
  }

  return {
    mainRule,
    subRule,
    promptContext: segments.join("\n"),
    source,
  };
}

function findPageByPropertyValue(
  pages: NotionQueryResult[],
  propertyName: string,
  expectedValue: string
): NotionQueryResult | null {
  const normalizedExpected = expectedValue.trim().toLowerCase();
  if (!normalizedExpected) return null;

  return (
    pages.find((page) => {
      const properties = page.properties && typeof page.properties === "object" ? (page.properties as Record<string, unknown>) : null;
      if (!properties || !(propertyName in properties)) return false;
      return propertyToString(properties[propertyName]).trim().toLowerCase() === normalizedExpected;
    }) || null
  );
}

export async function syncUserProfileToNotion(input: NotionUserSyncInput): Promise<{ pageId: string; database: NotionDatabaseSource }> {
  const token = getNotionToken();
  const database = await searchDatabaseByName(
    token,
    (process.env.NOTION_USERS_DB_NAME || DEFAULT_USERS_DB_NAME).trim(),
    process.env.NOTION_USERS_DATABASE_ID || ""
  );
  const databaseDetails = await getDatabaseDetails(token, database.id);
  const schema = databaseDetails.properties && typeof databaseDetails.properties === "object"
    ? (databaseDetails.properties as Record<string, unknown>)
    : {};
  const pages = await queryDatabasePages(token, database.id);

  const existingPage =
    findPageByPropertyValue(pages, "email", input.email) ||
    findPageByPropertyValue(pages, "display_name", input.name);

  const properties = buildPropertyPayload(schema, {
    display_name: input.name,
    email: input.email,
    music_source: input.musicSource,
    lastfm_username: input.lastfmUsername || "",
    spotify_connected: input.spotifyConnected,
    country: input.country,
    city: input.city,
    style_note: input.styleNote || "",
    is_active: true,
  });

  const response =
    existingPage && typeof existingPage.id === "string" && existingPage.id
      ? await updatePageProperties(token, existingPage.id, properties)
      : await createPageInDatabase(token, database.id, properties);

  return {
    pageId: typeof response.id === "string" ? response.id : "",
    database,
  };
}

export async function createWeeklyRunInNotion(input: NotionWeeklyRunInput): Promise<{ pageId: string; database: NotionDatabaseSource }> {
  const token = getNotionToken();
  const database = await searchDatabaseByName(
    token,
    (process.env.NOTION_WEEKLY_RUNS_DB_NAME || DEFAULT_WEEKLY_RUNS_DB_NAME).trim(),
    process.env.NOTION_WEEKLY_RUNS_DATABASE_ID || ""
  );
  const databaseDetails = await getDatabaseDetails(token, database.id);
  const schema = databaseDetails.properties && typeof databaseDetails.properties === "object"
    ? (databaseDetails.properties as Record<string, unknown>)
    : {};

  const properties = buildPropertyPayload(schema, {
    session_name: input.sessionName,
    user_name: input.userName,
    music_source: input.musicSource,
    lastfm_username: input.lastfmUsername || "",
    main_genre_key: normalizeGenreKey(input.mainGenreKey),
    secondary_genre_key: normalizeGenreKey(input.secondaryGenreKey),
    analysis_type: input.analysisType,
    listen_count: input.listenCount,
    day1_clothes_key: input.day1ClothesKey,
    day1_shoes_key: input.day1ShoesKey,
    day2_headwear_key: input.day2HeadwearKey,
    day2_handheld_key: input.day2HandheldKey,
    day3_accessory_key: input.day3AccessoryKey,
    base_key: input.baseKey,
    final_prompt: input.finalPrompt,
    pet_image_url: input.petImageUrl,
    status: input.status,
  });

  const response = await createPageInDatabase(token, database.id, properties);
  return {
    pageId: typeof response.id === "string" ? response.id : "",
    database,
  };
}
