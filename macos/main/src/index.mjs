#!/usr/bin/env node

import { spawn, spawnSync, execFile } from "node:child_process";
import { ProxyAgent } from "undici";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createConnection } from "node:net";

const VERSION = "2.30.2-macos";
const API_BASE = "https://api-v2.soundcloud.com";
const LEGACY_CONFIG_DIR = join(homedir(), ".soundcloud-random-music");

function detectDataDir() {
  const portableDir = process.env.SRM_DATA_DIR || process.env.SRM_PORTABLE_DATA_DIR;
  if (portableDir && String(portableDir).trim()) return String(portableDir).trim();
  // Windows portable fallback: store user data near the launcher/app folder.
  if (process.platform === "win32") return join(process.cwd(), "data");
  return LEGACY_CONFIG_DIR;
}

const CONFIG_DIR = detectDataDir();
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const STATE_PATH = join(CONFIG_DIR, "state.json");
const LEGACY_CONFIG_PATH = join(LEGACY_CONFIG_DIR, "config.json");
const LEGACY_STATE_PATH = join(LEGACY_CONFIG_DIR, "state.json");

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const ALT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const DEFAULT_CONFIG = {
  defaultSource: "all",
  player: "auto",
  network: {
    retries: 3,
    timeoutMs: 15000,
    proxyUrl: "",
    streamRetries: 1,
    trackDelayMs: 200,
    validateStream: true,
    fallbackToPermalink: false,
    startupTimeoutMs: 6500,
    openBrowserOnPlaybackFail: false
  },
  controls: {
    inputMode: "auto",
    cleanConsole: true
  },
  ui: {
    language: "en"
  },
  browserPlayer: {
    enabled: false,
    backend: "mpv",
    browser: "auto",
    hideWindow: true,
    cookieBrowser: "off"
  },
  playback: {
    method: "smart",
    mode: "auto",
    tempDownloadFallback: false,
    volume: 80
  },
  preload: {
    enabled: true
  },
  cache: {
    clientId: "",
    clientIdUpdatedAt: ""
  },
  sources: []
};

const DEFAULT_STATE = {
  blacklist: [],
  played: [],
  history: []
};

const DEMO_TRACKS = [
  { id: "demo1", title: "Soft Static", user: { username: "Demo" }, permalink_url: "https://soundcloud.com/demo/soft-static" },
  { id: "demo2", title: "Night Bus", user: { username: "Demo" }, permalink_url: "https://soundcloud.com/demo/night-bus" },
  { id: "demo3", title: "Rain Window", user: { username: "Demo" }, permalink_url: "https://soundcloud.com/demo/rain-window" },
  { id: "demo4", title: "Warm Keys", user: { username: "Demo" }, permalink_url: "https://soundcloud.com/demo/warm-keys" }
];


const I18N = {
  ru: {
    menuHelp: "Стрелки вверх/вниз = выбор, Enter = открыть, q/Esc = выход/назад",
    mainPlay: "Запустить рандом",
    mainAdd: "Добавить источник",
    mainList: "Показать источники",
    mainStats: "Статистика",
    mainSettings: "Настройки",
    mainClearPlayed: "Очистить прослушанные",
    mainClearBlacklist: "Очистить чёрный список",
    mainExit: "Выход",
    settingsTitle: "Настройки",
    settingsBackend: "Backend",
    settingsBrowser: "Cookies",
    settingsMethod: "Метод получения",
    settingsPlayback: "Воспроизведение",
    settingsInput: "Ввод",
    settingsProxy: "Прокси",
    settingsLanguage: "Язык",
    back: "Назад",
    langTitle: "Язык интерфейса",
    backendTitle: "Backend",
    backendLine1: "mpv быстрый режим через терминал",
    backendLine2: "Браузерный backend удалён: он открывал вкладки и не давал честно понять, играет ли звук.",
    pressEnterBack: "Нажми Enter, чтобы вернуться.",
    browserTitle: "Cookies disabled",
    methodTitle: "Метод получения музыки",
    playbackTitle: "Метод воспроизведения",
    playbackStream: "stream через mpv",
    playbackDownload: "скачать во временный файл и играть",
    inputTitle: "Настройки ввода",
    proxyTitle: "Настройки прокси",
    currentProxy: "Текущий прокси",
    setProxy: "Указать прокси",
    clearProxy: "Отключить прокси",
    proxyPrompt: "Прокси URL, например http://127.0.0.1:7890",
    sourceName: "Имя источника",
    sourceUrl: "Ссылка SoundCloud /likes или /sets/...",
    added: "Добавлено",
    pressEnterMenu: "Нажми Enter, чтобы вернуться в меню.",
    playedCleared: "Прослушанные очищены.",
    blacklistCleared: "Чёрный список очищен.",
    fileSettings: "Файл настроек",
    mode: "Режим",
    searchingClient: "Ищу публичный ключ SoundCloud web app...",
    source: "Источник",
    profileFound: "Профиль найден",
    tracksFromSource: "Треков из источника",
    totalTracks: "Всего треков из источников",
    blacklist: "В чёрном списке",
    played: "Уже прослушано",
    available: "Доступно для рандома сейчас",
    randomTrack: "Случайный трек",
    nextFromHistory: "Следующий из истории",
    previousAvailable: "Назад доступно",
    buttonBack: "кнопка Назад",
    gettingAudio: "Получаю аудио",
    resolving: "получение",
    playback: "воспроизведение",
    methodApi: "Метод: SoundCloud stream API",
    methodYtdlp: "Метод: yt-dlp",
    methodYtdlpCookies: "Метод: yt-dlp + cookies (disabled)",
    player: "Плеер",
    checkingTrack: "Проверяю трек...",
    waitingSound: "Жду реального старта звука...",
    trackNotStarted: "Трек не начал играть, пробую другой способ...",
    nowPlaying: "Сейчас играет",
    trackStarted: "Трек запущен",
    inputLineMode: "Режим ввода: команды с Enter. Напиши n / b / p / q и нажми Enter.",
    playing: "Играет",
    paused: "Пауза",
    next: "Дальше",
    prev: "Назад",
    pause: "Пауза",
    resume: "Играть",
    repeat: "Повтор",
    repeatShort: "Повт",
    volume: "Звук",
    menu: "Меню",
    on: "вкл",
    off: "выкл",
    session: "Сессия",
    tracks: "треков",
    cacheAudio: "Беру аудио из кэша прошлой/текущей/следующей песни...",
    preloadWaiting: "Следующая песня уже загружается, жду готовый аудио-поток...",
    preloadFailed: "Предзагрузка не помогла, получаю аудио заново...",
    playbackFailed: "Трек не заиграл в терминале, добавляю в чёрный список и беру следующий. Браузер больше не открываю.",
    noPrevious: "Назад пока нельзя: предыдущей песни ещё нет.",
    shortWarn1: "Внимание: два трека подряд длились 30 секунд или меньше.",
    shortWarn2: "Похоже, SoundCloud/mpv мог отдать короткие preview-потоки.",
    shortWarn3: "Лучше перезапусти SRM через start.command, чтобы обновить сессию и ключи.",
    shortWarn4: "Если эти треки реально короткие, просто запусти рандом снова.",
    statsTitle: "SoundCloud Random Music — статистика",
    file: "Файл",
    historyTotal: "Всего прослушиваний в истории",
    totalTime: "Всего времени",
    last7: "За 7 дней",
    last30: "За 30 дней",
    topArtists: "Топ артистов",
    noHistory: "Пока нет истории. Запусти пару треков через srm.",
    hours: "ч"
  },
  en: {
    menuHelp: "Up/Down arrows = select, Enter = open, q/Esc = exit/back",
    mainPlay: "Start random",
    mainAdd: "Add source",
    mainList: "Show sources",
    mainStats: "Statistics",
    mainSettings: "Settings",
    mainClearPlayed: "Clear played tracks",
    mainClearBlacklist: "Clear blacklist",
    mainExit: "Exit",
    settingsTitle: "Settings",
    settingsBackend: "Backend",
    settingsBrowser: "Cookies",
    settingsMethod: "Audio method",
    settingsPlayback: "Playback",
    settingsInput: "Input",
    settingsProxy: "Proxy",
    settingsLanguage: "Language",
    back: "Back",
    langTitle: "Interface language",
    backendTitle: "Backend",
    backendLine1: "mpv fast terminal mode",
    backendLine2: "Browser backend was removed because it opened tabs and could not reliably detect real playback.",
    pressEnterBack: "Press Enter to go back.",
    browserTitle: "Cookies disabled",
    methodTitle: "Audio resolving method",
    playbackTitle: "Playback method",
    playbackStream: "stream through mpv",
    playbackDownload: "download to temporary file and play",
    inputTitle: "Input settings",
    proxyTitle: "Proxy settings",
    currentProxy: "Current proxy",
    setProxy: "Set proxy",
    clearProxy: "Disable proxy",
    proxyPrompt: "Proxy URL, for example http://127.0.0.1:7890",
    sourceName: "Source name",
    sourceUrl: "SoundCloud /likes or /sets/... URL",
    added: "Added",
    pressEnterMenu: "Press Enter to return to the menu.",
    playedCleared: "Played tracks cleared.",
    blacklistCleared: "Blacklist cleared.",
    fileSettings: "Config file",
    mode: "Mode",
    searchingClient: "Looking for public SoundCloud web app key...",
    source: "Source",
    profileFound: "Profile found",
    tracksFromSource: "Tracks from source",
    totalTracks: "Total tracks from sources",
    blacklist: "In blacklist",
    played: "Already played",
    available: "Available for random now",
    randomTrack: "Random track",
    nextFromHistory: "Next from history",
    previousAvailable: "Back available",
    buttonBack: "Back button",
    gettingAudio: "Getting audio",
    resolving: "resolving",
    playback: "playback",
    methodApi: "Method: SoundCloud stream API",
    methodYtdlp: "Method: yt-dlp",
    methodYtdlpCookies: "Method: yt-dlp + cookies (disabled)",
    player: "Player",
    checkingTrack: "Checking track...",
    waitingSound: "Waiting for real audio start...",
    trackNotStarted: "Track did not start, trying another method...",
    nowPlaying: "Now playing",
    trackStarted: "Track started",
    inputLineMode: "Input mode: commands with Enter. Type n / b / p / q and press Enter.",
    playing: "Playing",
    paused: "Paused",
    next: "Next",
    prev: "Back",
    pause: "Pause",
    resume: "Play",
    repeat: "Repeat",
    repeatShort: "Repeat",
    volume: "Volume",
    menu: "Menu",
    on: "on",
    off: "off",
    session: "Session",
    tracks: "tracks",
    cacheAudio: "Using cached audio for previous/current/next track...",
    preloadWaiting: "Next track is already preloading, waiting for prepared audio...",
    preloadFailed: "Preload failed, resolving audio again...",
    playbackFailed: "Track did not play in terminal, adding it to blacklist and picking another one. Browser will not open.",
    noPrevious: "Cannot go back yet: there is no previous track.",
    shortWarn1: "Warning: two tracks in a row lasted 30 seconds or less.",
    shortWarn2: "SoundCloud/mpv may have returned short preview streams.",
    shortWarn3: "Restart SRM through start.bat to refresh the session and keys.",
    shortWarn4: "If these tracks are really short, just start random again.",
    statsTitle: "SoundCloud Random Music — statistics",
    file: "File",
    historyTotal: "Total plays in history",
    totalTime: "Total time",
    last7: "Last 7 days",
    last30: "Last 30 days",
    topArtists: "Top artists",
    noHistory: "No history yet. Play a few tracks with srm.",
    hours: "h"
  }
};

function langOf(config = null) {
  const raw = String(valueOf("--language") || valueOf("--lang") || config?.ui?.language || "en").toLowerCase().trim();
  return raw === "en" || raw === "english" ? "en" : "ru";
}

function t(config, key) {
  const lang = langOf(config);
  return I18N[lang]?.[key] || I18N.ru[key] || key;
}

function appLanguage() {
  try { return langOf(loadConfig()); } catch { return "en"; }
}

function tt(key) {
  const lang = appLanguage();
  return I18N[lang]?.[key] || I18N.ru[key] || key;
}


const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const color = {
  dim: (text) => USE_COLOR ? `\x1b[2m${text}\x1b[0m` : text,
  green: (text) => USE_COLOR ? `\x1b[32m${text}\x1b[0m` : text,
  cyan: (text) => USE_COLOR ? `\x1b[36m${text}\x1b[0m` : text,
  yellow: (text) => USE_COLOR ? `\x1b[33m${text}\x1b[0m` : text,
  red: (text) => USE_COLOR ? `\x1b[31m${text}\x1b[0m` : text,
  bold: (text) => USE_COLOR ? `\x1b[1m${text}\x1b[0m` : text
};

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = String(value % 60).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
  return `${minutes}:${rest}`;
}

function progressBar(current, duration, width = 14) {
  const total = Number(duration) || 0;
  if (total <= 0) return `[${"-".repeat(width)}]`;
  const ratio = Math.max(0, Math.min(1, (Number(current) || 0) / total));
  const filled = Math.round(ratio * width);
  return `[${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}]`;
}

function artworkUrl(track) {
  const raw = track?.artwork_url || track?.user?.avatar_url || "";
  if (!raw) return "";
  return String(raw).replace(/-large\./, "-t500x500.").replace(/-t120x120\./, "-t500x500.");
}

function printArtwork(track) {
  const url = artworkUrl(track);
  if (!url) return;
  console.log(`${color.cyan(appLanguage() === "en" ? "Artwork:" : "Обложка:")} ${url}`);
}

function artistName(trackOrEntry) {
  const explicit = trackOrEntry?.artist || trackOrEntry?.user?.username || trackOrEntry?.username;
  if (explicit) return String(explicit);
  const title = String(trackOrEntry?.title || "");
  if (title.includes(" — ")) return title.split(" — ")[0].trim();
  return "Unknown";
}

const argv = process.argv.slice(2);
const parsed = parseArgs(argv);

function parseArgs(args) {
  const flags = new Set();
  const values = new Map();
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [name, inlineValue] = arg.split("=", 2);
      flags.add(name);
      const wantsValue = ["--player", "--add", "--remove", "--default", "--proxy", "--browser-player", "--backend", "--input", "--cookies-browser", "--method", "--playback", "--language", "--lang"].includes(name);
      if (inlineValue !== undefined) {
        values.set(name, inlineValue);
      } else if (wantsValue && args[i + 1] && !args[i + 1].startsWith("--")) {
        if (name === "--add") {
          values.set(name, [args[i + 1], args[i + 2]].filter(Boolean));
          i += args[i + 2] && !args[i + 2].startsWith("--") ? 2 : 1;
        } else {
          values.set(name, args[i + 1]);
          i += 1;
        }
      }
    } else if (arg === "-h") {
      flags.add("--help");
    } else {
      positional.push(arg);
    }
  }
  return { flags, values, positional };
}

function hasFlag(name) { return parsed.flags.has(name); }
function valueOf(name) { return parsed.values.get(name); }

function showHelp() {
  const en = appLanguage() === "en";
  if (en) {
    console.log(`
SoundCloud Random Music v${VERSION}

Basic:
  srm                         Play random from defaultSource in config.json
  srm <url>                   Play random from a specific SoundCloud URL
  srm --loop                  Keep playing random tracks
  srm --no-play               Only print selected track
  srm --open                  Open selected track in browser

Playback controls:
  Left / Right arrows          Select action
  Enter                        Confirm selected action
  n                            Next track
  b                            Back to previous track
  p / Space                    Pause / resume
  r                            Repeat on/off
  q / Esc                      Exit

Settings:
  srm --init-config            Create config.json
  srm --config-path            Show config.json path
  srm --show-config            Show config.json
  srm --list                   Show sources
  srm --stats                  Listening statistics
  srm --clear-played           Clear played tracks
  srm --clear-blacklist        Clear blacklist
  srm --add likes <url>        Add likes/playlist source
  srm --remove likes           Remove source
  srm --default all            Use all sources by default
  srm --player mpv             Save player: auto, mpv, ffplay, vlc
  srm --language en            Set interface language: en/ru
  srm --method smart           Set audio resolving method (no cookies)
  srm --playback auto          Set playback mode
  srm --input line             Commands are typed as n + Enter
  srm --input raw              Hotkeys without Enter

Example:
  srm --add likes https://soundcloud.com/arx_1/likes
  srm --language en
  srm
`);
    return;
  }

  console.log(`
SoundCloud Random Music v${VERSION}

Основное:
  srm                         Играть рандом из defaultSource в config.json
  srm <url>                   Играть рандом из конкретной ссылки SoundCloud
  srm --loop                  Бесконечный рандом
  srm --no-play               Только вывести выбранный трек
  srm --open                  Открыть выбранный трек в браузере

Управление во время музыки:
  Стрелки влево/вправо        Выбрать действие
  Enter                       Подтвердить действие
  n / т / д                   Следующий трек
  b / и                       Назад к прошлому треку
  p / з / Space               Пауза / продолжить
  r / к                       Включить/выключить повтор
  q / й / Esc                 Выход

Настройки:
  srm --init-config           Создать config.json
  srm --config-path           Показать путь к config.json
  srm --show-config           Показать config.json
  srm --list                  Показать источники
  srm --stats                 Статистика
  srm --clear-played          Очистить прослушанные
  srm --clear-blacklist       Очистить чёрный список
  srm --add likes <url>       Добавить лайки/плейлист
  srm --remove likes          Удалить источник
  srm --default all           Рандом из всех источников
  srm --player mpv            Сохранить плеер
  srm --language ru           Язык интерфейса: ru/en
  srm --method smart          Метод получения аудио без cookies
  srm --playback auto         Режим воспроизведения
  srm --input line            Команды как n + Enter
  srm --input raw             Горячие клавиши без Enter

Пример:
  srm --add likes https://soundcloud.com/arx_1/likes
  srm --language en
  srm
`);
}

async function ask(question, defaultValue = "") {
  const rl = createInterface({ input, output });
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  rl.close();
  return answer || defaultValue;
}

function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

function migrateLegacyDataIfNeeded() {
  if (CONFIG_DIR === LEGACY_CONFIG_DIR) return;
  ensureConfigDir();
  try {
    if (!existsSync(CONFIG_PATH) && existsSync(LEGACY_CONFIG_PATH)) copyFileSync(LEGACY_CONFIG_PATH, CONFIG_PATH);
  } catch {}
  try {
    if (!existsSync(STATE_PATH) && existsSync(LEGACY_STATE_PATH)) copyFileSync(LEGACY_STATE_PATH, STATE_PATH);
  } catch {}
}

function loadConfig() {
  migrateLegacyDataIfNeeded();
  if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_CONFIG);
  try {
    const loaded = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    const merged = {
      ...structuredClone(DEFAULT_CONFIG),
      ...loaded,
      network: { ...DEFAULT_CONFIG.network, ...(loaded.network || {}) },
      cache: { ...DEFAULT_CONFIG.cache, ...(loaded.cache || {}) },
      controls: { ...DEFAULT_CONFIG.controls, ...(loaded.controls || {}) },
      ui: { ...DEFAULT_CONFIG.ui, ...(loaded.ui || {}) },
      browserPlayer: { ...DEFAULT_CONFIG.browserPlayer, ...(loaded.browserPlayer || {}) },
      playback: { ...DEFAULT_CONFIG.playback, ...(loaded.playback || {}) },
      sources: Array.isArray(loaded.sources) ? loaded.sources : []
    };
    // Начиная с 2.11.0 браузер больше не используется как плеер.
    // Если в старом конфиге был backend=browser, автоматически возвращаем mpv.
    if (merged.browserPlayer?.backend === "browser" || merged.browserPlayer?.enabled === true) {
      merged.browserPlayer = { ...merged.browserPlayer, backend: "mpv", enabled: false };
    }
    // Windows fast profile: do not spend 30+ seconds on tracks that mpv cannot start.
    // If a track fails the quick SoundCloud/mpv check, skip it and preload another one.
    merged.network = {
      ...merged.network,
      openBrowserOnPlaybackFail: false,
      fallbackToPermalink: false,
      retries: Math.min(2, Math.max(1, Number(merged.network?.retries || 2))),
      timeoutMs: Math.min(7000, Math.max(3000, Number(merged.network?.timeoutMs || 6000))),
      streamRetries: Math.min(1, Math.max(1, Number(merged.network?.streamRetries || 1))),
      trackDelayMs: Math.min(300, Math.max(0, Number(merged.network?.trackDelayMs || 200))),
      startupTimeoutMs: Math.min(8000, Math.max(4000, Number(merged.network?.startupTimeoutMs || 6500)))
    };
    merged.playback = {
      ...merged.playback,
      tempDownloadFallback: false
    };
    return merged;
  } catch (error) {
    throw new Error(`Не могу прочитать config.json: ${error.message}`);
  }
}

function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function loadState() {
  migrateLegacyDataIfNeeded();
  if (!existsSync(STATE_PATH)) return structuredClone(DEFAULT_STATE);
  try {
    const loaded = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    return {
      blacklist: Array.isArray(loaded.blacklist) ? loaded.blacklist : [],
      played: Array.isArray(loaded.played) ? loaded.played : [],
      history: Array.isArray(loaded.history) ? loaded.history : []
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(state) {
  ensureConfigDir();
  const clean = {
    blacklist: Array.isArray(state.blacklist) ? state.blacklist : [],
    played: Array.isArray(state.played) ? state.played : [],
    history: Array.isArray(state.history) ? state.history.slice(-10000) : []
  };
  writeFileSync(STATE_PATH, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
}

function trackKey(track) {
  return String(track?.permalink_url || track?.id || "");
}

function stateKeys(items) {
  return new Set((items || []).map((item) => String(item.key || item.url || item.id || "")).filter(Boolean));
}

function stateEntry(track, extra = {}) {
  return {
    key: trackKey(track),
    title: displayTrack(track),
    url: track?.permalink_url || "",
    addedAt: new Date().toISOString(),
    ...extra
  };
}

function upsertStateEntry(state, listName, entry) {
  if (!entry?.key) return false;
  const list = Array.isArray(state[listName]) ? state[listName] : [];
  const next = list.filter((item) => item.key !== entry.key && item.url !== entry.key);
  next.push(entry);
  state[listName] = next;
  saveState(state);
  return true;
}


function appendHistoryEntry(state, track, data = {}) {
  const durationSec = Math.max(0, Math.floor(Number(data.durationSec) || 0));
  const entry = {
    key: trackKey(track),
    title: displayTrack(track),
    artist: artistName(track),
    url: track?.permalink_url || "",
    artworkUrl: artworkUrl(track),
    durationSec,
    source: data.source || "playback",
    playedAt: new Date().toISOString()
  };
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push(entry);
  if (state.history.length > 10000) state.history = state.history.slice(-10000);
  saveState(state);
  return entry;
}

function statsForHistory(history, days = null) {
  const now = Date.now();
  const minTime = days ? now - days * 24 * 60 * 60 * 1000 : 0;
  const items = (history || []).filter((item) => {
    const t = Date.parse(item.playedAt || item.addedAt || "");
    return Number.isFinite(t) && t >= minTime;
  });
  const totalSeconds = items.reduce((sum, item) => sum + Math.max(0, Number(item.durationSec) || 0), 0);
  const artistCounts = new Map();
  for (const item of items) {
    const name = artistName(item);
    const current = artistCounts.get(name) || { plays: 0, seconds: 0 };
    current.plays += 1;
    current.seconds += Math.max(0, Number(item.durationSec) || 0);
    artistCounts.set(name, current);
  }
  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1].plays - a[1].plays || b[1].seconds - a[1].seconds)
    .slice(0, 10)
    .map(([artist, value]) => ({ artist, ...value }));
  return { count: items.length, totalSeconds, topArtists };
}

function printStats() {
  const state = loadState();
  const history = Array.isArray(state.history) ? state.history : [];
  const all = statsForHistory(history);
  const week = statsForHistory(history, 7);
  const month = statsForHistory(history, 30);
  const hours = (seconds) => (Math.max(0, Number(seconds) || 0) / 3600).toFixed(2);

  console.log(color.bold(tt("statsTitle")));
  console.log(`${tt("file")}: ${STATE_PATH}`);
  console.log("");
  console.log(`${tt("historyTotal")}: ${all.count}`);
  console.log(`${tt("totalTime")}: ${hours(all.totalSeconds)} ${tt("hours")} (${formatTime(all.totalSeconds)})`);
  console.log(`${tt("last7")}: ${week.count} ${tt("tracks")}, ${hours(week.totalSeconds)} ${tt("hours")}`);
  console.log(`${tt("last30")}: ${month.count} ${tt("tracks")}, ${hours(month.totalSeconds)} ${tt("hours")}`);
  console.log(`Played: ${(state.played || []).length}`);
  console.log(`Blacklist: ${(state.blacklist || []).length}`);
  console.log("");
  console.log(color.bold(`${tt("topArtists")}:`));
  const top = all.topArtists.length ? all.topArtists : [];
  if (top.length === 0) console.log(tt("noHistory"));
  top.forEach((item, index) => {
    console.log(`${index + 1}. ${item.artist} — ${item.plays} ${tt("tracks")}, ${hours(item.seconds)} ${tt("hours")}`);
  });
}

function removeFromAvailableByKey(available, key) {
  const index = available.findIndex((track) => trackKey(track) === key);
  if (index >= 0) available.splice(index, 1);
}

function normalizeSoundCloudUrl(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl).trim()); } catch { throw new Error("Это не похоже на нормальную ссылку."); }
  if (!url.hostname.endsWith("soundcloud.com")) {
    throw new Error("Нужна ссылка soundcloud.com, например https://soundcloud.com/arx_1/likes");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function isLikesUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  return url.pathname.split("/").filter(Boolean).includes("likes");
}

function profileUrlFromLikesUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  const [username] = url.pathname.split("/").filter(Boolean);
  if (!username) throw new Error("Не могу понять имя профиля из ссылки likes.");
  return `https://soundcloud.com/${username}`;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function requestHeaders(kind = "html", ua = BROWSER_UA) {
  const common = {
    "user-agent": ua,
    "accept-language": "en-US,en;q=0.9,ru;q=0.8",
    "referer": "https://soundcloud.com/",
    "origin": "https://soundcloud.com"
  };
  if (kind === "json") return { ...common, "accept": "application/json,text/plain,*/*" };
  return { ...common, "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
}

function getProxyUrl(config) {
  return config.network?.proxyUrl || process.env.SRM_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
}

function fetchDispatcher(config) {
  const proxyUrl = getProxyUrl(config);
  if (!proxyUrl) return undefined;
  try {
    return new ProxyAgent(proxyUrl);
  } catch (error) {
    throw new Error(`Некорректный proxyUrl в config.json: ${error.message}`);
  }
}

async function fetchWithRetry(url, options = {}) {
  const config = loadConfig();
  const retries = Number(config.network?.retries || 3);
  const timeoutMs = Number(config.network?.timeoutMs || 15000);
  const userAgents = [BROWSER_UA, ALT_UA];
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const ua = userAgents[(attempt - 1) % userAgents.length];

    try {
      const dispatcher = fetchDispatcher(config);
      const response = await fetch(url, {
        ...options,
        ...(dispatcher ? { dispatcher } : {}),
        signal: controller.signal,
        headers: {
          ...requestHeaders(options.kind || "html", ua),
          ...(options.headers || {})
        }
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        console.log(`${appLanguage() === "en" ? "Network did not respond, retrying" : "Сеть не ответила, пробую ещё раз"} ${attempt}/${retries}...`);
        await sleep(700 * attempt);
      }
    }
  }

  const en = appLanguage() === "en";
  throw new Error(en
    ? `fetch failed: ${lastError?.message || "network error"}. If SoundCloud does not open without VPN, SRM cannot fix it without a proxy or another network.`
    : `fetch failed: ${lastError?.message || "network error"}. Если без VPN SoundCloud не открывается даже через curl, программа это не исправит без прокси/другой сети.`
  );
}

async function fetchText(url) {
  const response = await fetchWithRetry(url, { kind: "html" });
  if (!response.ok) throw new Error(`HTTP ${response.status} при загрузке ${url}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { kind: "json" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SoundCloud вернул HTTP ${response.status}. ${body.slice(0, 180)}`.trim());
  }
  return response.json();
}

function absolutizeUrl(url) {
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://soundcloud.com${url}`;
  return url;
}

function extractClientIdFromCode(code) {
  const patterns = [
    /client_id\s*[:=]\s*["']([A-Za-z0-9]{32})["']/,
    /clientId\s*[:=]\s*["']([A-Za-z0-9]{32})["']/,
    /client_id=([A-Za-z0-9]{32})/,
    /[?&]client_id=([A-Za-z0-9]{32})/
  ];
  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

let cachedClientId = null;
async function findWebClientId({ refresh = false } = {}) {
  if (cachedClientId && !refresh) return cachedClientId;

  const config = loadConfig();
  if (!refresh && config.cache?.clientId && /^[A-Za-z0-9]{32}$/.test(config.cache.clientId)) {
    cachedClientId = config.cache.clientId;
    return cachedClientId;
  }

  const homepage = await fetchText("https://soundcloud.com/");
  const direct = extractClientIdFromCode(homepage);
  if (direct) {
    config.cache = { ...(config.cache || {}), clientId: direct, clientIdUpdatedAt: new Date().toISOString() };
    saveConfig(config);
    return (cachedClientId = direct);
  }

  const scripts = [...homepage.matchAll(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>/g)]
    .map((match) => absolutizeUrl(match[1]))
    .filter((url) => url.includes("sndcdn.com") || url.includes("soundcloud.com"));

  if (scripts.length === 0) throw new Error("Не нашла JS-файлы SoundCloud для публичного client_id.");

  for (const scriptUrl of scripts.reverse()) {
    try {
      const code = await fetchText(scriptUrl);
      const clientId = extractClientIdFromCode(code);
      if (clientId) {
        config.cache = { ...(config.cache || {}), clientId, clientIdUpdatedAt: new Date().toISOString() };
        saveConfig(config);
        return (cachedClientId = clientId);
      }
    } catch {}
  }
  throw new Error("Не смогла найти публичный client_id web-версии SoundCloud.");
}

function buildApiUrl(path, params = {}) {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function resolveSoundCloudUrl(url, clientId) {
  return fetchJson(buildApiUrl("/resolve", { url, client_id: clientId }));
}

function compactTrack(track) {
  if (!track || track.kind !== "track") return null;
  return track;
}

function hasApiTranscodings(track) {
  return Array.isArray(track?.media?.transcodings) && track.media.transcodings.length > 0;
}

function isPlayableTrack(track) {
  // Для yt-dlp + cookies достаточно permalink_url. Если требовать media.transcodings,
  // часть лайков пропадает из выдачи SoundCloud API, хотя в браузере и через yt-dlp они могут играть.
  return Boolean(track?.kind === "track" && track.permalink_url);
}

function uniqueById(tracks) {
  const seen = new Set();
  const result = [];
  for (const track of tracks) {
    const key = track?.id || track?.permalink_url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(track);
  }
  return result;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function hydrateTracksByIds(ids, clientId) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const tracks = [];
  for (const part of chunk(uniqueIds, 50)) {
    const data = await fetchJson(buildApiUrl("/tracks", { ids: part.join(","), client_id: clientId }));
    if (Array.isArray(data)) tracks.push(...data.map(compactTrack).filter(Boolean));
  }
  return uniqueById(tracks);
}

async function collectPlaylistTracks(playlist, clientId) {
  const embedded = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const fullTracks = embedded.filter(isPlayableTrack);
  const missingIds = embedded.filter((track) => track?.id && !isPlayableTrack(track)).map((track) => track.id);
  if (missingIds.length === 0) return uniqueById(fullTracks);
  const hydrated = await hydrateTracksByIds(missingIds, clientId);
  return uniqueById([...fullTracks, ...hydrated]).filter(isPlayableTrack);
}

async function collectLikesTracks(user, clientId) {
  const tracks = [];
  let nextUrl = buildApiUrl(`/users/${user.id}/likes`, { client_id: clientId, limit: 200, linked_partitioning: 1 });
  while (nextUrl) {
    const page = await fetchJson(nextUrl);
    const collection = Array.isArray(page) ? page : page.collection;
    if (!Array.isArray(collection)) break;
    for (const item of collection) {
      const track = compactTrack(item?.track || item);
      if (track) tracks.push(track);
    }
    nextUrl = page.next_href || null;
    if (nextUrl && !new URL(nextUrl).searchParams.has("client_id")) nextUrl = buildApiUrl(nextUrl, { client_id: clientId });
  }
  return uniqueById(tracks).filter(isPlayableTrack);
}

async function collectTracksFromSource(sourceUrl, clientId) {
  if (isLikesUrl(sourceUrl)) {
    const profileUrl = profileUrlFromLikesUrl(sourceUrl);
    const user = await resolveSoundCloudUrl(profileUrl, clientId);
    if (user.kind !== "user") throw new Error("Ссылка /likes есть, но профиль SoundCloud не найден.");
    console.log(`${tt("profileFound")}: ${user.username || user.permalink || user.id}`);
    return collectLikesTracks(user, clientId);
  }
  const resolved = await resolveSoundCloudUrl(sourceUrl, clientId);
  if (resolved.kind === "track") return isPlayableTrack(resolved) ? [resolved] : [];
  if (resolved.kind === "playlist") {
    console.log(`${appLanguage() === "en" ? "Playlist found" : "Плейлист найден"}: ${resolved.title || resolved.permalink || resolved.id}`);
    return collectPlaylistTracks(resolved, clientId);
  }
  if (resolved.kind === "user") throw new Error("Это ссылка на профиль. Нужна /likes или /sets/...");
  throw new Error(`Не знаю, как работать с типом: ${resolved.kind || "unknown"}`);
}

function pickRandom(items) { return items[Math.floor(Math.random() * items.length)]; }

function displayTrack(track) {
  const artist = track.user?.username || track.publisher_metadata?.artist || track.artist || "Unknown artist";
  const title = track.title || track.permalink || track.permalink_url;
  return `${artist} — ${title}`;
}

function transcodingLabel(item) {
  const protocol = item?.format?.protocol || "unknown";
  const mime = item?.format?.mime_type || "unknown";
  const preset = item?.preset || "";
  return [protocol, mime, preset].filter(Boolean).join(" / ");
}

function scoreTranscoding(item) {
  const protocol = item?.format?.protocol || "";
  const mime = item?.format?.mime_type || "";
  const preset = item?.preset || "";

  // SoundCloud постепенно переводит playback API на AAC HLS. MPV хорошо играет HLS,
  // поэтому сначала пробуем HLS/AAC, потом другой HLS, и только затем старый progressive MP3.
  if (protocol === "hls" && (mime.includes("audio/aac") || preset.includes("aac_160"))) return 100;
  if (protocol === "hls" && preset.includes("aac")) return 95;
  if (protocol === "hls" && mime.includes("audio/mpeg")) return 80;
  if (protocol === "hls") return 70;
  if (protocol === "progressive" && mime.includes("audio/mpeg")) return 50;
  if (protocol === "progressive") return 40;
  return 10;
}

function chooseTranscodings(track) {
  const transcodings = track.media?.transcodings || [];
  return [...transcodings]
    .filter((item) => item?.url)
    .sort((a, b) => scoreTranscoding(b) - scoreTranscoding(a));
}

async function getPlaybackUrlFromTranscoding(track, transcoding, clientId) {
  const params = { client_id: clientId };
  if (track.track_authorization) params.track_authorization = track.track_authorization;
  const data = await fetchJson(buildApiUrl(transcoding.url, params));
  if (!data?.url) throw new Error("SoundCloud не вернул прямой stream URL.");
  return data.url;
}

async function validatePlaybackUrl(streamUrl) {
  const config = loadConfig();
  if (config.network?.validateStream === false) return true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(config.network?.timeoutMs || 15000)));
  try {
    const dispatcher = fetchDispatcher(config);
    const response = await fetch(streamUrl, {
      ...(dispatcher ? { dispatcher } : {}),
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_UA,
        "accept": "audio/*,application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
        "referer": "https://soundcloud.com/",
        "range": "bytes=0-1"
      }
    });
    if (![200, 206].includes(response.status)) throw new Error(`stream HTTP ${response.status}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

async function getStreamUrl(track, clientId, allowFreshResolve = true) {
  const config = loadConfig();
  const transcodings = chooseTranscodings(track);
  if (transcodings.length === 0) throw new Error("У выбранного трека нет stream/transcoding URL.");

  const streamRetries = Math.max(1, Number(config.network?.streamRetries || 3));
  const trackDelayMs = Math.max(0, Number(config.network?.trackDelayMs || 1200));
  const errors = [];
  let activeClientId = clientId;

  for (const transcoding of transcodings) {
    const label = transcodingLabel(transcoding);
    for (let attempt = 1; attempt <= streamRetries; attempt += 1) {
      try {
        if (trackDelayMs > 0 && attempt > 1) await sleep(trackDelayMs * attempt);
        if (attempt > 1) console.log(`${appLanguage() === "en" ? "Stream retry" : "Повтор stream"} ${attempt}/${streamRetries}: ${label}`);
        const streamUrl = await getPlaybackUrlFromTranscoding(track, transcoding, activeClientId);
        await validatePlaybackUrl(streamUrl);
        return streamUrl;
      } catch (error) {
        const message = error?.message || String(error);
        errors.push(`${label}: ${message}`);

        // Иногда web client_id протухает: один раз обновляем и повторяем.
        if ((message.includes("HTTP 401") || message.includes("HTTP 403") || message.includes("HTTP 404")) && attempt === 1) {
          try {
            activeClientId = await findWebClientId({ refresh: true });
            await sleep(trackDelayMs || 900);
            const streamUrl = await getPlaybackUrlFromTranscoding(track, transcoding, activeClientId);
            await validatePlaybackUrl(streamUrl);
            return streamUrl;
          } catch (refreshError) {
            errors.push(`${label} after client_id refresh: ${refreshError?.message || refreshError}`);
          }
        }

        if (attempt < streamRetries) await sleep(trackDelayMs || 900);
      }
    }
  }

  if (allowFreshResolve && track.permalink_url) {
    try {
      console.log(appLanguage() === "en" ? "Refreshing track data and trying again..." : "Обновляю данные трека и пробую ещё раз...");
      const freshTrack = await resolveSoundCloudUrl(track.permalink_url, activeClientId);
      if (freshTrack?.kind === "track" && freshTrack?.id !== undefined) {
        await sleep(trackDelayMs || 900);
        return await getStreamUrl(freshTrack, activeClientId, false);
      }
    } catch (freshError) {
      errors.push(`fresh resolve: ${freshError?.message || freshError}`);
    }
  }

  throw new Error(`не удалось получить playable stream после ${transcodings.length} вариантов. Последнее: ${errors.at(-1) || "unknown"}`);
}

function commandExists(command) {
  if (command.includes("/") || command.includes("\\")) return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
  const checker = process.platform === "win32" ? spawnSync("where", [command], { stdio: "ignore" }) : spawnSync("sh", ["-lc", `command -v ${JSON.stringify(command)} >/dev/null 2>&1`], { stdio: "ignore" });
  return checker.status === 0;
}

function mpvArgs() {
  return ["--no-video", "--force-window=no", "--no-input-terminal", "--no-terminal", "--really-quiet", "--term-playing-msg=", "--user-agent=Mozilla/5.0", "--referrer=https://soundcloud.com/"];
}

function availablePlayers() {
  const candidates = [];

  // Prefer console-friendly mpv.com on Windows when present.
  if (process.platform === "win32") {
    candidates.push(
      { name: "mpv", command: "mpv", args: mpvArgs() },
      { name: "mpv", command: join("C:\\", "Program Files", "MPV Player", "mpv.com"), args: mpvArgs() },
      { name: "mpv", command: join("C:\\", "Program Files", "MPV Player", "mpv.exe"), args: mpvArgs() },
      { name: "mpv", command: join("C:\\", "Program Files (x86)", "MPV Player", "mpv.com"), args: mpvArgs() },
      { name: "mpv", command: join("C:\\", "Program Files (x86)", "MPV Player", "mpv.exe"), args: mpvArgs() }
    );
  } else {
    candidates.push(
      { name: "mpv", command: "mpv", args: mpvArgs() },
      { name: "mpv", command: "/usr/local/bin/mpv", args: mpvArgs() },
      { name: "mpv", command: "/opt/homebrew/bin/mpv", args: mpvArgs() }
    );
  }

  candidates.push(
    { name: "ffplay", command: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "warning"] },
    { name: "vlc", command: "vlc", args: ["--intf", "dummy", "--play-and-exit", "--http-user-agent=Mozilla/5.0", "--http-referrer=https://soundcloud.com/"] }
  );
  if (process.platform === "darwin") candidates.push({ name: "vlc", command: "/Applications/VLC.app/Contents/MacOS/VLC", args: ["--intf", "dummy", "--play-and-exit"] });
  return candidates.filter((candidate) => commandExists(candidate.command));
}

function selectPlayer(config) {
  const forced = valueOf("--player") || config.player;
  const players = availablePlayers();
  if (forced && forced !== "auto") {
    const found = players.find((candidate) => candidate.name === forced || candidate.command === forced);
    if (found) return found;
    throw new Error(`Плеер ${forced} не найден. Проверь: which ${forced}`);
  }
  return players[0] || null;
}

function printPlayerInstallHelp() {
  console.log(`
Не нашла mpv/ffplay/vlc в PATH.
macOS: brew install mpv
Windows: winget install --id shinchiro.mpv -e --source winget
`);
}

function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function stopProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    // mpv.com часто запускает mpv.exe дочерним процессом. Обычный child.kill()
    // может остановить только оболочку, а звук останется играть. taskkill /T
    // закрывает всё дерево процесса, поэтому при "Дальше" старая песня не остаётся.
    try { execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {}); } catch {}
  } else {
    try { child.kill("SIGTERM"); } catch {}
    setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 800).unref?.();
  }
}


function cookieBrowserCandidates(config, explicit = null) {
  // Cookies mode was removed in Windows 2.29.0.
  // On this setup it caused long waits and repeated Edge/Chrome database errors,
  // while SoundCloud API + plain yt-dlp worked better.
  return [];
}

function looksLikePath(command) {
  const value = String(command || "");
  return value.includes("\\") || value.includes("/") || /^[A-Za-z]:/.test(value);
}

function uniqueExistingOrNamed(commands) {
  const seen = new Set();
  const out = [];
  for (const command of commands) {
    if (!command) continue;
    const value = String(command);
    if (looksLikePath(value) && !existsSync(value)) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function whereCommand(command) {
  try {
    const tool = process.platform === "win32" ? "where.exe" : "sh";
    const args = process.platform === "win32"
      ? [command]
      : ["-lc", `command -v ${JSON.stringify(command)} 2>/dev/null || true`];
    const result = spawnSync(tool, args, { encoding: "utf8" });
    const text = `${result.stdout || ""}\n${result.stderr || ""}`;
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function ytDlpCandidates() {
  const candidates = [];

  // First use whatever the current shell sees. On Windows this usually resolves
  // to %LOCALAPPDATA%\Microsoft\WinGet\Links\yt-dlp.exe.
  candidates.push(...whereCommand("yt-dlp"));
  if (process.platform === "win32") candidates.push(...whereCommand("yt-dlp.exe"));

  candidates.push("yt-dlp");

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const userProfile = process.env.USERPROFILE || "";
    candidates.push(
      localAppData ? join(localAppData, "Microsoft", "WinGet", "Links", "yt-dlp.exe") : "",
      userProfile ? join(userProfile, "AppData", "Local", "Microsoft", "WinGet", "Links", "yt-dlp.exe") : "",
      join("C:\\", "Program Files", "yt-dlp", "yt-dlp.exe"),
      join("C:\\", "Program Files (x86)", "yt-dlp", "yt-dlp.exe")
    );
  } else {
    candidates.push("/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp");
  }

  // Keep macOS/Linux paths away from Windows, otherwise the final error is
  // misleading: spawn /usr/local/bin/yt-dlp ENOENT.
  return uniqueExistingOrNamed(candidates);
}

function execFileText(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: options.timeout || 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.shortMessage = stderr ? String(stderr).split("\n").find(Boolean) || error.message : error.message;
        reject(error);
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

async function resolveWithYtDlp(trackUrl, cookieBrowser = "") {
  const args = [
    "-g",
    "--no-playlist",
    "--extractor-retries", "1",
    "--fragment-retries", "1",
    "--socket-timeout", "6",
    "--user-agent", BROWSER_UA,
    "--referer", "https://soundcloud.com/"
  ];
  if (cookieBrowser && cookieBrowser !== "off") args.push("--cookies-from-browser", cookieBrowser);
  args.push(trackUrl);

  let lastError = "";
  for (const command of ytDlpCandidates()) {
    try {
      const out = await execFileText(command, args, { timeout: 10000 });
      const urls = out.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^https?:\/\//i.test(line));
      if (urls.length > 0) return urls[0];
    } catch (error) {
      lastError = error.shortMessage || error.message;
    }
  }
  throw new Error(lastError || "yt-dlp не вернул playable URL");
}

function getPlaybackMethod(config) {
  let raw = String(valueOf("--method") || config.playback?.method || "smart").toLowerCase().trim();
  // Backward compatibility for old configs. Cookies are disabled in Windows 2.29.0.
  if (raw === "yt-dlp-cookies-first" || raw === "auto") raw = "smart";
  const allowed = new Set(["smart", "soundcloud-api-first", "yt-dlp-first"]);
  return allowed.has(raw) ? raw : "smart";
}

function getPlaybackMode(config) {
  const raw = String(valueOf("--playback") || config.playback?.mode || "auto").toLowerCase().trim();
  const allowed = new Set(["auto", "stream", "download-temp"]);
  return allowed.has(raw) ? raw : "auto";
}

function safeTempName() {
  return `srm-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function downloadWithYtDlp(trackUrl, config) {
  const outTemplate = join(tmpdir(), `${safeTempName()}.%(ext)s`);
  const browsers = cookieBrowserCandidates(config, valueOf("--cookies-browser"));
  const attempts = [...browsers, ""];
  const seen = new Set();
  let lastError = null;

  for (const browser of attempts) {
    const key = browser || "no-cookies";
    if (seen.has(key)) continue;
    seen.add(key);

    const args = [
      "--no-playlist",
      "-f", "bestaudio/best",
      "--extractor-retries", "1",
      "--fragment-retries", "1",
      "--socket-timeout", "20",
      "--user-agent", BROWSER_UA,
      "--referer", "https://soundcloud.com/",
      "-o", outTemplate,
      "--print", "after_move:filepath"
    ];
    if (browser && browser !== "off") args.push("--cookies-from-browser", browser);
    args.push(trackUrl);

    for (const command of ytDlpCandidates()) {
      try {
        console.log(`${appLanguage() === "en" ? "Downloading temporary file through yt-dlp" : "Скачиваю во временный файл через yt-dlp"}${browser ? ` + cookies ${browser}` : ""}...`);
        const out = await execFileText(command, args, { timeout: 25000 });
        const file = out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse().find((line) => existsSync(line));
        if (file) return { kind: "file", value: file, tempFile: file };
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw new Error(String(lastError?.shortMessage || lastError?.message || lastError || "yt-dlp не скачал временный файл").split("\n")[0]);
}

function cleanupPlayItem(item) {
  if (item?.kind === "file" && item.tempFile) {
    try { unlinkSync(item.tempFile); } catch {}
  }
}

async function resolveByMethod(track, config, clientId) {
  const method = getPlaybackMethod(config);
  const url = track?.permalink_url;
  if (!url) throw new Error("У трека нет permalink_url.");

  const tryApi = async () => {
    console.log(tt("methodApi"));
    return await getStreamUrl(track, clientId);
  };
  const tryYtdlp = async (browser = "") => {
    console.log(`${tt("methodYtdlp")}${browser ? ` + cookies ${browser}` : ""}`);
    return await resolveWithYtDlp(url, browser);
  };
  const tryCookieYtdlp = async () => {
    throw new Error(appLanguage() === "en" ? "cookies mode is disabled" : "режим cookies отключён");
  };

  if (method === "smart") {
    // Windows default: fast mode without cookies.
    // Cookies caused repeated Edge/Chrome database errors and long waits.
    try { return await tryApi(); }
    catch (apiError) {
      console.log(`${appLanguage() === "en" ? "SoundCloud API did not return a stream, trying yt-dlp" : "SoundCloud API не дал поток, пробую yt-dlp"}: ${String(apiError.shortMessage || apiError.message || apiError).split("\n")[0]}`);
    }
    return await tryYtdlp("");
  }

  if (method === "soundcloud-api-first") {
    try { return await tryApi(); }
    catch (error) { console.log(`${appLanguage() === "en" ? "SoundCloud API failed, trying yt-dlp" : "SoundCloud API не помог, пробую yt-dlp"}: ${String(error.shortMessage || error.message || error).split("\n")[0]}`); }
    return await tryYtdlp("");
  }
  if (method === "yt-dlp-first") {
    try { return await tryYtdlp(""); }
    catch (error) { console.log(`${appLanguage() === "en" ? "yt-dlp failed, trying SoundCloud API" : "yt-dlp не помог, пробую SoundCloud API"}: ${String(error.shortMessage || error.message || error).split("\n")[0]}`); return await tryApi(); }
  }
  // Legacy auto/cookies methods are mapped to smart by getPlaybackMethod().
  try { return await tryApi(); }
  catch (apiError) {
    console.log(`${appLanguage() === "en" ? "SoundCloud API also did not return a stream" : "SoundCloud API тоже не дал поток"}: ${String(apiError.message || apiError).split("\n")[0]}`);
    throw apiError;
  }
}

async function playStreamInteractive(playUrl, config, options = {}) {
  const player = selectPlayer(config);
  if (!player) { printPlayerInstallHelp(); return "no-player"; }

  console.log(`${t(config, "player")}: ${player.name}`);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let paused = false;
    let lastTimePos = 0;
    let lastDuration = Math.max(0, Number(options.durationSec) || 0);
    let hasRealPlaybackSignal = false;
    let announcedPlayback = false;
    let lastCheckPrintedAt = 0;
    let pauseBusy = false;
    let repeatEnabled = Boolean(options.repeatEnabled);
    let volume = clampNumber(options.volume ?? config.playback?.volume ?? 80, 0, 100, 80);
    let volumeMode = false;
    let volumeBusy = false;
    const quietOutput = player.name === "mpv";

    const ipcPath = player.name === "mpv"
      ? (process.platform === "win32"
          ? `\\\\.\\pipe\\srm-mpv-${process.pid}-${Date.now()}`
          : join(tmpdir(), `srm-mpv-${process.pid}-${Date.now()}.sock`))
      : null;

    const extraMpvArgs = [];
    if (player.name === "mpv") extraMpvArgs.push(`--volume=${volume}`);
    if (player.name === "mpv" && options.ytdlpMode) {
      extraMpvArgs.push("--ytdl=yes", "--ytdl-format=bestaudio/best");
      if (options.cookieBrowser) {
        extraMpvArgs.push(`--ytdl-raw-options=cookies-from-browser=${options.cookieBrowser},extractor-retries=3,fragment-retries=3`);
      } else {
        extraMpvArgs.push("--ytdl-raw-options=extractor-retries=3,fragment-retries=3");
      }
    }

    const args = player.name === "mpv" && ipcPath
      ? [...player.args, ...extraMpvArgs, `--input-ipc-server=${ipcPath}`, playUrl]
      : [...player.args, playUrl];

    const child = spawn(player.command, args, {
      stdio: ["ignore", quietOutput ? "ignore" : "inherit", quietOutput ? "ignore" : "inherit"],
      windowsHide: true
    });

    const writeStatusLine = (text) => {
      // Keep the live status under one terminal line. Long lines wrap in macOS Terminal,
      // and then \r cannot overwrite them correctly.
      const width = Math.max(40, Math.min(process.stdout.columns || 80, 100));
      const safe = text.length >= width ? text.slice(0, width - 2) : text;
      process.stdout.write(`\r\x1b[2K${safe}`);
    };

    let controlIndex = 0;
    const controlItems = [
      { label: t(config, "next"), action: "next" },
      { label: t(config, "prev"), action: "previous" },
      { label: t(config, "pause"), action: "pause" },
      { label: t(config, "repeat"), action: "repeat" },
      { label: t(config, "volume"), action: "volume" },
      { label: t(config, "menu"), action: "quit" }
    ];
    const controlLabel = (item) => {
      if (item.action === "pause") return paused ? t(config, "resume") : t(config, "pause");
      if (item.action === "repeat") return `${t(config, "repeatShort")}:${repeatEnabled ? t(config, "on") : t(config, "off")}`;
      if (item.action === "volume") return volumeMode ? `${t(config, "volume")}:${volume}% ${progressBar(volume, 100, 6)}` : `${t(config, "volume")}:${volume}%`;
      return item.label;
    };
    const controlsText = () => controlItems.map((item, index) => {
      const label = controlLabel(item);
      return index === controlIndex ? `[${label}]` : label;
    }).join(" ");
    const runSelectedControl = () => {
      const action = controlItems[controlIndex]?.action;
      if (action === "next") finish("next");
      else if (action === "previous") finish("previous");
      else if (action === "pause") togglePause();
      else if (action === "repeat") toggleRepeat();
      else if (action === "volume") toggleVolumeMode();
      else if (action === "quit") finish("quit");
    };
    const statusText = () => {
      const current = formatTime(lastTimePos);
      const total = lastDuration > 0 ? `/${formatTime(lastDuration)}` : "";
      const remaining = lastDuration > 0 ? ` -${formatTime(Math.max(0, lastDuration - lastTimePos))}` : "";
      const session = Number(options.sessionPlayedCount) >= 0 ? ` | S:${options.sessionPlayedCount}` : "";
      const bar = progressBar(lastTimePos, lastDuration, 10);
      const base = `${paused ? t(config, "paused") : t(config, "playing")} ${current}${total}${remaining} ${bar} | ${controlsText()}${session}`;
      return paused ? color.yellow(base) : color.green(base);
    };

    function mpvCommand(command, timeoutMs = 800) {
      if (!ipcPath || player.name !== "mpv") return Promise.resolve(null);
      return new Promise((res) => {
        const socket = createConnection(ipcPath);
        let buffer = "";
        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          socket.destroy();
          res(null);
        }, timeoutMs);
        socket.on("connect", () => socket.write(`${JSON.stringify({ command })}\n`));
        socket.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
          const line = buffer.split("\n").find(Boolean);
          if (!line) return;
          try {
            const parsed = JSON.parse(line);
            if (!done) {
              done = true;
              clearTimeout(timer);
              socket.end();
              res(parsed);
            }
          } catch {}
        });
        socket.on("error", () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          res(null);
        });
      });
    }

    async function togglePause() {
      if (pauseBusy) return;
      pauseBusy = true;
      try {
        if (player.name === "mpv") {
          // Надёжнее просить mpv переключить pause внутри себя,
          // а не считать состояние только в интерфейсе srm.
          await mpvCommand(["cycle", "pause"], 1500);
          await sleep(120);
          const answer = await mpvCommand(["get_property", "pause"], 1500);
          paused = typeof answer?.data === "boolean" ? answer.data : !paused;
        } else {
          paused = !paused;
          // Для ffplay/vlc точного pause-control нет, но SIGSTOP/SIGCONT работает на macOS/Linux.
          try { child.kill(paused ? "SIGSTOP" : "SIGCONT"); } catch {}
        }
        writeStatusLine(statusText());
      } finally {
        pauseBusy = false;
      }
    }

    function toggleRepeat() {
      repeatEnabled = !repeatEnabled;
      if (typeof options.onRepeatChanged === "function") {
        try { options.onRepeatChanged(repeatEnabled); } catch {}
      }
      writeStatusLine(statusText());
    }

    function toggleVolumeMode() {
      volumeMode = !volumeMode;
      writeStatusLine(statusText());
    }

    async function applyVolume(nextVolume) {
      if (volumeBusy) return;
      volumeBusy = true;
      try {
        volume = clampNumber(nextVolume, 0, 100, volume);
        if (player.name === "mpv") await mpvCommand(["set_property", "volume", volume], 1000);
        if (typeof options.onVolumeChanged === "function") {
          try { options.onVolumeChanged(volume); } catch {}
        }
        writeStatusLine(statusText());
      } finally {
        volumeBusy = false;
      }
    }

    function adjustVolume(delta) {
      applyVolume(volume + delta);
    }

    console.log(t(config, "checkingTrack"));

    // Для mpv берём реальное время из плеера. Счётчик начинает идти только когда mpv отдаёт time-pos > 0.
    // Для остальных плееров остаётся мягкий fallback, потому что у них нет простого IPC.
    let fallbackStartedAt = null;
    const startupTimeoutMs = Math.max(4000, Number(config.network?.startupTimeoutMs || 6500));
    const softStartFallback = options.softStartFallback !== false;
    const startupTimer = setTimeout(() => {
      if (!resolved && player.name === "mpv" && !hasRealPlaybackSignal) {
        // Windows/mpv sometimes starts audible playback before IPC time-pos begins
        // responding. Do not kill an actually playing track just because the IPC
        // timer is late. Switch to a soft timer and let mpv exit naturally.
        if (softStartFallback) {
          hasRealPlaybackSignal = true;
          fallbackStartedAt = Date.now();
          if (typeof options.onStarted === "function") {
            try { options.onStarted(); } catch {}
          }
          if (!announcedPlayback) {
            announcedPlayback = true;
            const titleLine = options.title ? `${t(config, "nowPlaying")}: ${options.title}` : t(config, "trackStarted");
            const urlLine = options.url ? `\n${options.url}` : "";
            process.stdout.write("\r\x1b[2K");
            console.log(`${titleLine}${urlLine}`);
          }
          writeStatusLine(statusText());
          return;
        }
        writeStatusLine(t(config, "trackNotStarted"));
        finish("failed");
      }
    }, startupTimeoutMs);
    startupTimer.unref?.();

    const statusTimer = setInterval(async () => {
      if (player.name === "mpv") {
        let answer = await mpvCommand(["get_property", "time-pos"], 500);
        let pos = Number(answer?.data);
        if (!Number.isFinite(pos)) {
          answer = await mpvCommand(["get_property", "playback-time"], 500);
          pos = Number(answer?.data);
        }
        if (Number.isFinite(pos) && pos > 0) {
          lastTimePos = pos;
          if (!hasRealPlaybackSignal) {
            hasRealPlaybackSignal = true;
            if (typeof options.onStarted === "function") {
              try { options.onStarted(); } catch {}
            }
          }
          if (!announcedPlayback) {
            announcedPlayback = true;
            const titleLine = options.title ? `${t(config, "nowPlaying")}: ${options.title}` : t(config, "trackStarted");
            const urlLine = options.url ? `\n${options.url}` : "";
            process.stdout.write("\r\x1b[2K");
            console.log(`${titleLine}${urlLine}`);
          }
        } else if (hasRealPlaybackSignal && fallbackStartedAt && !paused) {
          lastTimePos = Math.max(lastTimePos, (Date.now() - fallbackStartedAt) / 1000);
        }
        if (hasRealPlaybackSignal && player.name === "mpv") {
          const durationAnswer = await mpvCommand(["get_property", "duration"], 500);
          const duration = Number(durationAnswer?.data);
          if (Number.isFinite(duration) && duration > 0) lastDuration = duration;
        }
        if (!hasRealPlaybackSignal) {
          if (Date.now() - lastCheckPrintedAt > 2500) {
            lastCheckPrintedAt = Date.now();
            writeStatusLine(t(config, "waitingSound"));
          }
          return;
        }
        writeStatusLine(statusText());
        return;
      }

      if (!fallbackStartedAt) fallbackStartedAt = Date.now();
      if (!paused) lastTimePos = (Date.now() - fallbackStartedAt) / 1000;
      writeStatusLine(statusText());
    }, 700);
    statusTimer.unref?.();

    const restoreTerminal = () => {
      clearTimeout(startupTimer);
      clearInterval(statusTimer);
      process.stdout.write("\n");
      try { if (process.stdin.isTTY) process.stdin.setRawMode(false); } catch {}
      process.stdin.pause();
      process.stdin.off("keypress", onKeypress);
      process.stdin.off("data", onDataFallback);
    };

    const finish = (action) => {
      if (resolved) return;
      resolved = true;
      if (hasRealPlaybackSignal && typeof options.onFinished === "function") {
        try { options.onFinished({ durationSec: lastTimePos, totalDurationSec: lastDuration, action }); } catch {}
      }
      restoreTerminal();
      stopProcessTree(child);
      // На Windows taskkill закрывает дерево процесса не мгновенно. Маленькая пауза
      // не даёт старой песне играть поверх следующей.
      setTimeout(() => resolve(action), process.platform === "win32" ? 300 : 80);
    };

    const onKeypress = (str = "", key = {}) => {
      const text = String(str || key.sequence || key.name || "").toLowerCase();
      const name = String(key.name || "").toLowerCase();
      if (key.sequence === "" || (key.ctrl && name === "c")) finish("quit");
      else if (["q", "й", "escape", "esc"].includes(name) || ["q", "й"].includes(text)) finish("quit");
      else if (volumeMode && ["left", "down"].includes(name)) adjustVolume(-5);
      else if (volumeMode && ["right", "up"].includes(name)) adjustVolume(5);
      else if (["left", "up"].includes(name)) { controlIndex = (controlIndex - 1 + controlItems.length) % controlItems.length; writeStatusLine(statusText()); }
      else if (["right", "down"].includes(name)) { controlIndex = (controlIndex + 1) % controlItems.length; writeStatusLine(statusText()); }
      else if (["return", "enter"].includes(name)) runSelectedControl();
      else if (["p", "з", "space"].includes(name) || ["p", "з", " "].includes(text) || key.sequence === " ") togglePause();
      else if (["r", "к"].includes(name) || ["r", "к"].includes(text)) toggleRepeat();
      else if (["b", "и"].includes(name) || ["b", "и"].includes(text)) finish("previous");
      else if (["n", "т", "д", "l"].includes(name) || ["n", "т", "д", "l"].includes(text)) finish("next");
    };

    const onDataFallback = (buffer) => {
      const text = buffer.toString("utf8").toLowerCase();
      if (text.includes("\u0003") || buffer.includes(3) || text.includes("q") || text.includes("й")) finish("quit");
      else if (text.includes("+") || text.includes("=")) adjustVolume(5);
      else if (text.includes("-") || text.includes("_")) adjustVolume(-5);
      else if (text.includes("v") || text.includes("м")) toggleVolumeMode();
      else if (text.includes("p") || text.includes("з") || text.includes(" ")) togglePause();
      else if (text.includes("r") || text.includes("к")) toggleRepeat();
      else if (text.includes("b") || text.includes("и")) finish("previous");
      else if (text.includes("n") || text.includes("т") || text.includes("д") || text.includes("l") || text.includes("\r") || text.includes("\n")) runSelectedControl();
    };

    const inputMode = valueOf("--input") || config.controls?.inputMode || "auto";
    if (inputMode === "line") {
      console.log(t(config, "inputLineMode"));
      process.stdin.setEncoding("utf8");
      process.stdin.resume();
      process.stdin.on("data", onDataFallback);
    } else {
      emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.setEncoding("utf8");
      process.stdin.resume();
      process.stdin.on("keypress", onKeypress);
      // В raw-режиме нельзя одновременно слушать и keypress, и data:
      // одно нажатие может прийти дважды. Из-за этого пауза могла срабатывать через раз,
      // а выход мог перехватываться нестабильно.
    }

    child.on("error", (error) => { restoreTerminal(); reject(error); });
    child.on("exit", (code) => {
      if (resolved) return;
      resolved = true;
      restoreTerminal();
      // Если mpv умер до реального time-pos, считаем трек незаигравшим и пробуем fallback/следующий.
      if (code && !hasRealPlaybackSignal && player.name === "mpv") resolve("failed");
      else if (code && lastTimePos < 4) resolve("failed");
      else {
        const endAction = repeatEnabled ? "repeat" : "ended";
        if (hasRealPlaybackSignal && typeof options.onFinished === "function") {
          try { options.onFinished({ durationSec: lastTimePos, totalDurationSec: lastDuration, action: endAction }); } catch {}
        }
        resolve(endAction);
      }
    });
  });
}

async function waitForEnter(message = "Нажми Enter, когда проверка/страница в браузере открылась...") {
  if (!process.stdin.isTTY) return;
  try { process.stdin.setRawMode?.(false); } catch {}
  const rl = createInterface({ input, output });
  try {
    await rl.question(`${message}\n`);
  } finally {
    rl.close();
  }
}

function openUrl(url) {
  if (process.platform === "darwin") execFile("open", [url]);
  else if (process.platform === "win32") execFile("cmd", ["/c", "start", "", url], { windowsHide: true });
  else execFile("xdg-open", [url]);
}

function preferredBrowserName(config = {}) {
  const raw = String(config.browserPlayer?.browser || config.browserPlayer?.cookieBrowser || "edge").toLowerCase();
  if (raw === "chrome") return "Google Chrome";
  if (raw === "safari") return "Safari";
  return "Microsoft Edge";
}

function browserAppleScriptAppName(appName) {
  if (appName === "Google Chrome") return "Google Chrome";
  if (appName === "Safari") return "Safari";
  return "Microsoft Edge";
}

function openUrlInBackground(url, config = {}) {
  // Browser backend: используем выбранный браузер и одну активную вкладку.
  // Так старый трек чаще останавливается, потому что URL заменяется, а вкладки не плодятся.
  if (process.platform === "darwin") {
    const appName = browserAppleScriptAppName(preferredBrowserName(config));
    const escapedUrl = url.replace(/"/g, '\\"');
    const script = appName === "Safari" ? `
      set targetUrl to "${escapedUrl}"
      tell application "Safari"
        activate
        if not (exists document 1) then make new document
        set URL of document 1 to targetUrl
      end tell
    ` : `
      set targetUrl to "${escapedUrl}"
      tell application "${appName}"
        activate
        if not (exists window 1) then make new window
        set URL of active tab of window 1 to targetUrl
      end tell
    `;
    try { execFile("osascript", ["-e", script]); return; } catch {}
  }
  openUrl(url);
}

function stopBrowserPlayback(config = {}) {
  if (process.platform !== "darwin") return;
  const appName = browserAppleScriptAppName(preferredBrowserName(config));
  const script = appName === "Safari" ? `
    try
      tell application "Safari"
        if exists document 1 then set URL of document 1 to "about:blank"
      end tell
    end try
  ` : `
    try
      tell application "${appName}"
        if exists window 1 then set URL of active tab of window 1 to "about:blank"
      end tell
    end try
  `;
  try { execFile("osascript", ["-e", script]); } catch {}
}


async function playBrowserInteractive(track, config, options = {}) {
  // Важно: браузерный backend не умеет честно узнать, начался ли звук.
  // Поэтому больше не пишем "Сейчас играет" и не запускаем фейковый таймер.
  // Это просто режим "открыть трек в браузере и управлять переходами из терминала".
  let resolved = false;
  let elapsed = 0;
  let paused = false;

  console.log(appLanguage() === "en" ? "Browser mode: opening track in selected browser." : "Браузерный режим: открываю трек в выбранном браузере.");
  console.log(`${appLanguage() === "en" ? "Track" : "Трек"}: ${displayTrack(track)}`);
  console.log(track.permalink_url);
  console.log(appLanguage() === "en" ? "If audio does not start automatically, start the track in the browser once. Then switch tracks from the terminal." : "Если звук не стартовал автоматически, включи трек в браузере один раз. Дальше переключай из терминала.");
  openUrlInBackground(track.permalink_url, config);

  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    const rest = String(value % 60).padStart(2, "0");
    return `${minutes}:${rest}`;
  };

  const writeStatusLine = (text) => {
    const width = Math.max(40, Math.min(process.stdout.columns || 80, 100));
    const safe = text.length >= width ? text.slice(0, width - 2) : text;
    process.stdout.write(`\r\x1b[2K${safe}`);
  };

  let controlIndex = 0;
  const controlItems = [
    { label: "Следующий", action: "next" },
    { label: "Назад", action: "previous" },
    { label: "Пауза", action: "pause" },
    { label: "Выход", action: "quit" }
  ];
  const controlsText = () => controlItems.map((item, index) => index === controlIndex ? `[${item.label}]` : item.label).join("  ");
  const statusText = () => `${paused ? "Пауза" : "Открыто"} ${formatTime(elapsed)} | ${controlsText()}`;

  return new Promise((resolve) => {
    const finish = (action) => {
      if (resolved) return;
      resolved = true;
      clearInterval(timer);
      if (action === "quit" || action === "next" || action === "previous") stopBrowserPlayback(config);
      process.stdout.write("\n");
      try { if (process.stdin.isTTY) process.stdin.setRawMode(false); } catch {}
      process.stdin.pause();
      process.stdin.off("keypress", onKeypress);
      process.stdin.off("data", onDataFallback);
      resolve(action);
    };

    const togglePause = () => {
      paused = !paused;
      // Без управляемого браузера мы не можем надёжно нажать play/pause на странице SoundCloud.
      // Поэтому это только состояние интерфейса. Для реальной паузы используй backend mpv.
      writeStatusLine(statusText());
    };

    const runSelectedControl = () => {
      const action = controlItems[controlIndex]?.action;
      if (action === "next") finish("next");
      else if (action === "previous") finish("previous");
      else if (action === "pause") togglePause();
      else if (action === "quit") finish("quit");
    };

    const onKeypress = (str = "", key = {}) => {
      const text = String(str || key.sequence || key.name || "").toLowerCase();
      const name = String(key.name || "").toLowerCase();
      if (key.sequence === "\u0003" || (key.ctrl && name === "c")) finish("quit");
      else if (["q", "й", "escape", "esc"].includes(name) || ["q", "й"].includes(text)) finish("quit");
      else if (["left", "up"].includes(name)) { controlIndex = (controlIndex - 1 + controlItems.length) % controlItems.length; writeStatusLine(statusText()); }
      else if (["right", "down"].includes(name)) { controlIndex = (controlIndex + 1) % controlItems.length; writeStatusLine(statusText()); }
      else if (["return", "enter"].includes(name)) runSelectedControl();
      else if (["p", "з", "space"].includes(name) || ["p", "з", " "].includes(text) || key.sequence === " ") togglePause();
      else if (["b", "и"].includes(name) || ["b", "и"].includes(text)) finish("previous");
      else if (["n", "т", "д", "l"].includes(name) || ["n", "т", "д", "l"].includes(text)) finish("next");
    };

    const onDataFallback = (buffer) => {
      const text = buffer.toString("utf8").toLowerCase();
      if (text.includes("\u0003") || buffer.includes(3) || text.includes("q") || text.includes("й")) finish("quit");
      else if (text.includes("p") || text.includes("з") || text.includes(" ")) togglePause();
      else if (text.includes("b") || text.includes("и")) finish("previous");
      else if (text.includes("n") || text.includes("т") || text.includes("д") || text.includes("l") || text.includes("\r") || text.includes("\n")) runSelectedControl();
    };

    // Только отображаем, сколько времени прошло с открытия страницы.
    // НЕ считаем это подтверждением, что звук реально играет, и НЕ переключаем автоматически по duration.
    const timer = setInterval(() => {
      if (!paused) elapsed += 1;
      writeStatusLine(statusText());
    }, 1000);
    timer.unref?.();
    writeStatusLine(statusText());

    const inputMode = valueOf("--input") || config.controls?.inputMode || "auto";
    if (inputMode === "line") {
      process.stdin.setEncoding("utf8");
      process.stdin.resume();
      process.stdin.on("data", onDataFallback);
    } else {
      emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.setEncoding("utf8");
      process.stdin.resume();
      process.stdin.on("keypress", onKeypress);
    }
  });
}

async function loadTracksForSources(sources, clientId, config) {
  const all = [];
  for (const [index, source] of sources.entries()) {
    try {
      console.log(`\n[${index + 1}/${sources.length}] ${t(config, "source")}: ${source.name}`);
      const tracks = await collectTracksFromSource(source.url, clientId);
      console.log(`${t(config, "tracksFromSource")}: ${tracks.length}`);
      all.push(...tracks);
    } catch (error) {
      console.log(`${langOf(config) === "en" ? "Source skipped" : "Источник пропущен"}: ${error.message}`);
    }
  }
  return uniqueById(all);
}

function getActiveSources(config, explicitUrl = null) {
  if (explicitUrl) return [{ name: "url", url: normalizeSoundCloudUrl(explicitUrl), enabled: true }];
  const enabled = config.sources.filter((source) => source.enabled !== false);
  if (config.defaultSource === "all") return enabled;
  const selected = enabled.find((source) => source.name === config.defaultSource);
  if (!selected) throw new Error(`defaultSource "${config.defaultSource}" не найден. Проверь srm --list`);
  return [selected];
}

async function runPlayer(explicitUrl = null) {
  const config = loadConfig();
  const sources = getActiveSources(config, explicitUrl);
  if (sources.length === 0) throw new Error(`Нет источников. Добавь: srm --add likes https://soundcloud.com/arx_1/likes`);

  console.log(`${t(config, "fileSettings")}: ${CONFIG_PATH}`);
  console.log(`${t(config, "mode")}: ${explicitUrl ? "url" : config.defaultSource}`);
  console.log(t(config, "searchingClient"));
  const clientId = await findWebClientId();
  const tracks = await loadTracksForSources(sources, clientId, config);

  if (tracks.length === 0) throw new Error("Не нашла доступные треки. Возможно, лайки/плейлист закрыты или сеть режет SoundCloud.");

  const state = loadState();
  const blacklistKeys = stateKeys(state.blacklist);
  const playedKeys = stateKeys(state.played);
  const available = tracks.filter((track) => {
    const key = trackKey(track);
    return key && !blacklistKeys.has(key) && !playedKeys.has(key);
  });

  console.log(`\n${t(config, "totalTracks")}: ${tracks.length}`);
  console.log(`${t(config, "blacklist")}: ${blacklistKeys.size}`);
  console.log(`${t(config, "played")}: ${playedKeys.size}`);
  console.log(`${t(config, "available")}: ${available.length}`);

  if (available.length === 0) {
    throw new Error(`Нет новых треков для проигрывания. Можно очистить историю: srm --clear-played или чёрный список: srm --clear-blacklist`);
  }

  let keepGoing = true;
  let previousTrack = null;
  let currentTrack = null;
  let nextTrack = null;
  const playCache = new Map(); // хранит stream URL ровно для прошлой, текущей и следующей песни
  let sessionPlayedCount = 0;
  let sessionSeconds = 0;
  let repeatEnabled = false;
  let currentVolume = clampNumber(config.playback?.volume ?? 80, 0, 100, 80);
  let shortPlaybackStreak = 0;
  const onVolumeChanged = (value) => {
    currentVolume = clampNumber(value, 0, 100, currentVolume);
    config.playback = { ...(config.playback || {}), volume: currentVolume };
    try { saveConfig(config); } catch {}
  };

  const preloadPromises = new Map();

  const pickNextTrack = (excludeTracks = []) => {
    if (available.length === 0) return { track: null, index: -1 };
    const excluded = new Set(excludeTracks.map((item) => item?.permalink_url).filter(Boolean));
    const candidates = available
      .map((track, index) => ({ track, index }))
      .filter((item) => item.track?.permalink_url && !excluded.has(item.track.permalink_url));
    if (candidates.length === 0) return { track: null, index: -1 };
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const mutedConsole = async (fn) => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    try { return await fn(); }
    finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };

  const buildPlayItem = async (track, { quiet = false } = {}) => {
    const work = async () => {
      const mode = getPlaybackMode(config);
      if (!quiet) console.log(`${t(config, "gettingAudio")}... (${t(config, "resolving")}: ${getPlaybackMethod(config)}, ${t(config, "playback")}: ${mode})`);
      if (mode === "download-temp") return await downloadWithYtDlp(track.permalink_url, config);
      return { kind: "url", value: await resolveByMethod(track, config, clientId) };
    };
    return quiet ? await mutedConsole(work) : await work();
  };

  const prunePlayCache = (...tracksToKeep) => {
    const keep = new Set(tracksToKeep.map((item) => item?.permalink_url).filter(Boolean));
    for (const key of playCache.keys()) {
      if (!keep.has(key)) { cleanupPlayItem(playCache.get(key)); playCache.delete(key); }
    }
  };

  const reserveNextTrack = () => {
    if (nextTrack?.permalink_url) return nextTrack;
    const picked = pickNextTrack([previousTrack, currentTrack]);
    nextTrack = picked.track || null;
    return nextTrack;
  };

  const startPreloadNext = () => {
    if (hasFlag("--no-play") || hasFlag("--print-stream")) return;
    if (config.preload?.enabled === false) return;
    const target = reserveNextTrack();
    if (!target?.permalink_url) return;
    const key = target.permalink_url;
    if (playCache.has(key) || preloadPromises.has(key)) return;

    // Не печатаем сообщение о предзагрузке поверх live-строки плеера.
    // Иначе в Windows Terminal строка статуса и текст предзагрузки накладываются друг на друга.
    const promise = (async () => {
      try {
        const item = await buildPlayItem(target, { quiet: true });
        const stillNeeded = [previousTrack, currentTrack, nextTrack].some((itemTrack) => itemTrack?.permalink_url === key);
        if (stillNeeded) playCache.set(key, item);
        else cleanupPlayItem(item);
        return item;
      } catch (error) {
        // Preload must never crash the player. Some yt-dlp cookie errors happen
        // while another browser is open/locked; the current track should keep playing.
        return null;
      } finally {
        preloadPromises.delete(key);
      }
    })();
    // Attach a catch immediately so Node does not treat a preload failure as
    // an unhandled rejection. The awaited path below will simply rebuild audio.
    preloadPromises.set(key, promise.catch(() => null));
  };

  while (keepGoing && (available.length > 0 || currentTrack)) {
    const picked = currentTrack ? { track: currentTrack, index: available.findIndex((item) => item.permalink_url === currentTrack.permalink_url) } : pickNextTrack();
    const track = picked.track;
    const index = picked.index;
    currentTrack = track;

    if (!track) break;

    console.log(`\n${t(config, "randomTrack")}: ${displayTrack(track)}`);
    console.log(track.permalink_url);
    if (previousTrack) console.log(`${t(config, "previousAvailable")}: ${displayTrack(previousTrack)} (${t(config, "buttonBack")})`);
    if (nextTrack) console.log(`${t(config, "nextFromHistory")}: ${displayTrack(nextTrack)}`);

    if (hasFlag("--open")) { openUrl(track.permalink_url); return; }
    if (hasFlag("--no-play")) return;

    const backend = "mpv";

    let playItem;
    try {
      const delayMs = Math.max(0, Number(config.network?.trackDelayMs || 1200));
      if (delayMs > 0) await sleep(delayMs);
      const cached = playCache.get(track.permalink_url);
      if (cached) {
        console.log(t(config, "cacheAudio"));
        playItem = cached;
      } else if (preloadPromises.has(track.permalink_url)) {
        console.log(t(config, "preloadWaiting"));
        try {
          playItem = await preloadPromises.get(track.permalink_url);
          if (!playItem) throw new Error("preload failed");
        } catch {
          console.log(t(config, "preloadFailed"));
          playItem = await buildPlayItem(track);
        }
        if (playItem) playCache.set(track.permalink_url, playItem);
      } else {
        playItem = await buildPlayItem(track);
        playCache.set(track.permalink_url, playItem);
      }
    } catch (error) {
      const key = trackKey(track);
      upsertStateEntry(state, "blacklist", stateEntry(track, { reason: `stream-url: ${error.message}` }));
      if (key) blacklistKeys.add(key);
      if (index >= 0) available.splice(index, 1);
      currentTrack = null;
      console.log(`${appLanguage() === "en" ? "Track added to blacklist" : "Трек добавлен в чёрный список"}: ${error.message}`);
      console.log(`${appLanguage() === "en" ? "Tracks left for random" : "Осталось треков для рандома"}: ${available.length}`);
      if (available.length === 0) throw new Error("Все выбранные треки оказались недоступны для проигрывания.");
      continue;
    }

    if (hasFlag("--print-stream")) { console.log(playItem.value); return; }

    let didStart = false;
    let lastPlaySeconds = 0;
    let lastTotalDurationSec = 0;
    const handleStarted = () => {
      didStart = true;
      setTimeout(() => {
        try { startPreloadNext(); } catch {}
      }, 800).unref?.();
    };
    let action = await playStreamInteractive(playItem.value, config, {
      startDelayMs: 1200,
      title: displayTrack(track),
      url: track.permalink_url,
      durationSec: Number(track.duration || 0) / 1000,
      sessionPlayedCount,
      repeatEnabled,
      onRepeatChanged: (value) => { repeatEnabled = Boolean(value); },
      volume: currentVolume,
      onVolumeChanged,
      onStarted: handleStarted,
      softStartFallback: true,
      onFinished: (info) => {
        lastPlaySeconds = Math.max(lastPlaySeconds, Number(info?.durationSec) || 0);
        lastTotalDurationSec = Math.max(lastTotalDurationSec, Number(info?.totalDurationSec) || 0);
      }
    });

    if (action === "failed" && config.network?.fallbackToPermalink !== false && track.permalink_url) {
      console.log(appLanguage() === "en" ? "Stream URL did not play. Trying the track URL through mpv/yt-dlp..." : "Stream URL не заиграл. Пробую открыть саму ссылку трека через mpv/yt-dlp...");
      action = await playStreamInteractive(track.permalink_url, config, {
        startDelayMs: 1800,
        title: displayTrack(track),
        url: track.permalink_url,
        durationSec: Number(track.duration || 0) / 1000,
        sessionPlayedCount,
        repeatEnabled,
        onRepeatChanged: (value) => { repeatEnabled = Boolean(value); },
        volume: currentVolume,
        onVolumeChanged,
        ytdlpMode: true,
        onStarted: handleStarted,
        onFinished: (info) => {
        lastPlaySeconds = Math.max(lastPlaySeconds, Number(info?.durationSec) || 0);
        lastTotalDurationSec = Math.max(lastTotalDurationSec, Number(info?.totalDurationSec) || 0);
      }
      });
      if (action === "failed") {
        const browsers = cookieBrowserCandidates(config, valueOf("--cookies-browser"));
        for (const browser of browsers) {
          console.log(`${appLanguage() === "en" ? "Trying browser cookies" : "Пробую через cookies браузера"}: ${browser}...`);
          action = await playStreamInteractive(track.permalink_url, config, {
            startDelayMs: 1800,
            title: displayTrack(track),
            url: track.permalink_url,
            durationSec: Number(track.duration || 0) / 1000,
            sessionPlayedCount,
            repeatEnabled,
            onRepeatChanged: (value) => { repeatEnabled = Boolean(value); },
            volume: currentVolume,
            onVolumeChanged,
            ytdlpMode: true,
            cookieBrowser: browser,
            onStarted: handleStarted,
            onFinished: (info) => {
        lastPlaySeconds = Math.max(lastPlaySeconds, Number(info?.durationSec) || 0);
        lastTotalDurationSec = Math.max(lastTotalDurationSec, Number(info?.totalDurationSec) || 0);
      }
          });
          if (action !== "failed") break;
        }
      }
      if (action === "failed") {
        const directAttempts = ["", ...cookieBrowserCandidates(config, valueOf("--cookies-browser"))];
        const seenDirect = new Set();
        for (const browser of directAttempts) {
          const directKey = browser || "no-cookies";
          if (seenDirect.has(directKey)) continue;
          seenDirect.add(directKey);
          try {
            console.log(`${appLanguage() === "en" ? "Trying direct URL through yt-dlp" : "Пробую прямой URL через yt-dlp"}${browser ? ` + cookies ${browser}` : ""}...`);
            const directUrl = await resolveWithYtDlp(track.permalink_url, browser);
            action = await playStreamInteractive(directUrl, config, {
              startDelayMs: 1600,
              title: displayTrack(track),
              url: track.permalink_url,
              durationSec: Number(track.duration || 0) / 1000,
              sessionPlayedCount,
              repeatEnabled,
              onRepeatChanged: (value) => { repeatEnabled = Boolean(value); },
              volume: currentVolume,
              onVolumeChanged,
              onStarted: handleStarted,
              onFinished: (info) => {
        lastPlaySeconds = Math.max(lastPlaySeconds, Number(info?.durationSec) || 0);
        lastTotalDurationSec = Math.max(lastTotalDurationSec, Number(info?.totalDurationSec) || 0);
      }
            });
            if (action !== "failed") break;
          } catch (error) {
            console.log(`${appLanguage() === "en" ? "yt-dlp failed" : "yt-dlp не помог"}: ${String(error.shortMessage || error.message || error).split("\n")[0]}`);
          }
        }
      }
    }

    if (action === "failed" && getPlaybackMode(config) === "auto" && config.playback?.tempDownloadFallback === true) {
      try {
        console.log(appLanguage() === "en" ? "Stream did not play. Trying temporary download and local playback..." : "Поток не заиграл. Пробую скачать трек во временный файл и включить локально...");
        const downloaded = await downloadWithYtDlp(track.permalink_url, config);
        cleanupPlayItem(playItem);
        playItem = downloaded;
        playCache.set(track.permalink_url, playItem);
        action = await playStreamInteractive(playItem.value, config, {
          startDelayMs: 500,
          title: displayTrack(track),
          url: track.permalink_url,
          durationSec: Number(track.duration || 0) / 1000,
          sessionPlayedCount,
          repeatEnabled,
          onRepeatChanged: (value) => { repeatEnabled = Boolean(value); },
          volume: currentVolume,
          onVolumeChanged,
          onStarted: handleStarted,
          onFinished: (info) => {
        lastPlaySeconds = Math.max(lastPlaySeconds, Number(info?.durationSec) || 0);
        lastTotalDurationSec = Math.max(lastTotalDurationSec, Number(info?.totalDurationSec) || 0);
      }
        });
      } catch (error) {
        console.log(`${appLanguage() === "en" ? "Temporary download failed" : "Временная загрузка не помогла"}: ${String(error.message || error).split("\n")[0]}`);
      }
    }

    let countedThisTrack = false;
    const markPlayedIfStarted = () => {
      if (!didStart || countedThisTrack) return;
      countedThisTrack = true;
      const key = trackKey(track);
      upsertStateEntry(state, "played", stateEntry(track));
      appendHistoryEntry(state, track, { durationSec: lastPlaySeconds || Number(track.duration || 0) / 1000 });
      sessionPlayedCount += 1;
      sessionSeconds += Math.max(0, Math.floor(lastPlaySeconds || Number(track.duration || 0) / 1000));
      console.log(color.dim(`${t(config, "session")}: ${sessionPlayedCount} ${t(config, "tracks")}, ${formatTime(sessionSeconds)}`));
      if (key) {
        playedKeys.add(key);
        removeFromAvailableByKey(available, key);
      }
    };

    const shouldStopForShortPlaybackWarning = (playbackAction) => {
      if (!didStart) return false;
      // Считаем только треки, которые сами дошли до конца/повтора.
      // Если пользователь сам нажал «Дальше», это не короткий трек.
      if (!["ended", "repeat"].includes(playbackAction)) {
        shortPlaybackStreak = 0;
        return false;
      }
      const realDuration = Math.max(
        Number(lastTotalDurationSec) || 0,
        Number(lastPlaySeconds) || 0,
        Number(track.duration || 0) / 1000 || 0
      );
      if (realDuration > 0 && realDuration <= 30) {
        shortPlaybackStreak += 1;
      } else {
        shortPlaybackStreak = 0;
      }
      if (shortPlaybackStreak >= 2) {
        console.log("");
        console.log(color.yellow(t(config, "shortWarn1")));
        console.log(color.yellow(t(config, "shortWarn2")));
        console.log(color.yellow(t(config, "shortWarn3")));
        console.log(color.dim(t(config, "shortWarn4")));
        prunePlayCache();
        return true;
      }
      return false;
    };

    if (action === "repeat") {
      markPlayedIfStarted();
      if (shouldStopForShortPlaybackWarning(action)) {
        keepGoing = false;
        currentTrack = null;
        continue;
      }
      currentTrack = track;
      keepGoing = true;
    } else if (action === "previous") {
      markPlayedIfStarted();
      if (previousTrack) {
        const now = track;
        currentTrack = previousTrack;
        previousTrack = null;
        nextTrack = now;
        prunePlayCache(previousTrack, currentTrack, nextTrack);
        keepGoing = true;
      } else {
        console.log(t(config, "noPrevious"));
        currentTrack = track;
        keepGoing = true;
      }
    } else if (action === "failed") {
      const key = trackKey(track);
      upsertStateEntry(state, "blacklist", stateEntry(track, { reason: "playback-failed" }));
      if (key) blacklistKeys.add(key);
      if (index >= 0) available.splice(index, 1);
      currentTrack = null;
      prunePlayCache(previousTrack, nextTrack);
      console.log(t(config, "playbackFailed"));
      keepGoing = available.length > 0;
    } else if (action === "quit" || action === "no-player") {
      markPlayedIfStarted();
      prunePlayCache();
      keepGoing = false;
    } else if (action === "next") {
      markPlayedIfStarted();
      previousTrack = track;
      currentTrack = nextTrack || null;
      nextTrack = null;
      prunePlayCache(previousTrack, currentTrack, nextTrack);
      keepGoing = true;
    } else {
      // Трек закончился сам. По умолчанию сразу включаем следующий,
      // чтобы программа не закрывалась после одной песни.
      markPlayedIfStarted();
      if (shouldStopForShortPlaybackWarning(action)) {
        keepGoing = false;
        currentTrack = null;
        continue;
      }
      previousTrack = track;
      currentTrack = nextTrack || null;
      nextTrack = null;
      prunePlayCache(previousTrack, currentTrack, nextTrack);
      keepGoing = currentTrack || available.length > 0;
    }
  }
}

async function runDemo() {
  console.log(langOf(loadConfig()) === "en" ? "Demo mode: SoundCloud is not used." : "Demo-режим: SoundCloud не трогаю.");
  let keepGoing = true;
  while (keepGoing) {
    const track = pickRandom(DEMO_TRACKS);
    console.log(`${langOf(loadConfig()) === "en" ? "Selected track" : "Выбран трек"}: ${displayTrack(track)}`);
    console.log(track.permalink_url);
    if (!hasFlag("--loop")) keepGoing = false;
  }
}


function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

async function promptMenu(title, items) {
  if (!process.stdin.isTTY) return items[0]?.value;
  let index = 0;
  return new Promise((resolve) => {
    const render = () => {
      clearScreen();
      console.log(title);
      console.log("=".repeat(title.length));
      console.log("");
      items.forEach((item, i) => {
        const pointer = i === index ? ">" : " ";
        console.log(`${pointer} ${item.label}`);
      });
      console.log(`\n${tt("menuHelp")}`);
    };
    const cleanup = () => {
      try { process.stdin.setRawMode(false); } catch {}
      process.stdin.pause();
      process.stdin.off("keypress", onKeypress);
    };
    const finish = (value) => { cleanup(); clearScreen(); resolve(value); };
    const onKeypress = (_str = "", key = {}) => {
      const name = String(key.name || "").toLowerCase();
      if (key.ctrl && name === "c") finish("exit");
      else if (name === "up") { index = (index - 1 + items.length) % items.length; render(); }
      else if (name === "down") { index = (index + 1) % items.length; render(); }
      else if (name === "return" || name === "enter") finish(items[index].value);
      else if (["q", "escape", "esc"].includes(name)) finish("exit");
    };
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);
    render();
  });
}


async function backendSettingsMenu() {
  const config = loadConfig();
  console.clear?.();
  console.log(t(config, "backendTitle"));
  console.log("=======");
  console.log(`\n[x] ${t(config, "backendLine1")}`);
  console.log(`\n${t(config, "backendLine2")}`);
  console.log(t(config, "pressEnterBack"));
  await waitForEnter("");
}

async function browserSettingsMenu() {
  while (true) {
    const config = loadConfig();
    const cookieBrowser = config.browserPlayer?.cookieBrowser || "auto";
    const mark = (active) => active ? "[x]" : "[ ]";
    const choice = await promptMenu(t(config, "browserTitle"), [
      { label: `${mark(cookieBrowser === "auto")} auto`, value: "auto" },
      { label: `${mark(cookieBrowser === "edge")} Edge`, value: "edge" },
      { label: `${mark(cookieBrowser === "chrome")} Chrome`, value: "chrome" },
      { label: `${mark(cookieBrowser === "safari")} Safari`, value: "safari" },
      { label: `${mark(cookieBrowser === "off")} off`, value: "off" },
      { label: t(config, "back"), value: "exit" }
    ]);
    if (choice === "exit") return;

    const nextConfig = loadConfig();
    nextConfig.browserPlayer = { ...DEFAULT_CONFIG.browserPlayer, ...(nextConfig.browserPlayer || {}), cookieBrowser: choice };
    saveConfig(nextConfig);
  }
}

async function methodSettingsMenu() {
  while (true) {
    const config = loadConfig();
    const method = getPlaybackMethod(config);
    const mark = (active) => active ? "[x]" : "[ ]";
    const choice = await promptMenu(t(config, "methodTitle"), [
      { label: `${mark(method === "smart")} smart: API -> yt-dlp`, value: "smart" },
      { label: `${mark(method === "soundcloud-api-first")} SoundCloud API first`, value: "soundcloud-api-first" },
      { label: `${mark(method === "yt-dlp-first")} yt-dlp first`, value: "yt-dlp-first" },
      { label: t(config, "back"), value: "exit" }
    ]);
    if (choice === "exit") return;

    const nextConfig = loadConfig();
    nextConfig.playback = { ...DEFAULT_CONFIG.playback, ...(nextConfig.playback || {}), method: choice };
    saveConfig(nextConfig);
  }
}

async function playbackSettingsMenu() {
  while (true) {
    const config = loadConfig();
    const mode = getPlaybackMode(config);
    const mark = (active) => active ? "[x]" : "[ ]";
    const choice = await promptMenu(t(config, "playbackTitle"), [
      { label: `${mark(mode === "auto")} auto: stream -> temp download`, value: "auto" },
      { label: `${mark(mode === "stream")} ${t(config, "playbackStream")}`, value: "stream" },
      { label: `${mark(mode === "download-temp")} ${t(config, "playbackDownload")}`, value: "download-temp" },
      { label: t(config, "back"), value: "exit" }
    ]);
    if (choice === "exit") return;

    const nextConfig = loadConfig();
    nextConfig.playback = { ...DEFAULT_CONFIG.playback, ...(nextConfig.playback || {}), mode: choice };
    saveConfig(nextConfig);
  }
}

async function inputSettingsMenu() {
  while (true) {
    const config = loadConfig();
    const inputMode = config.controls?.inputMode || "auto";
    const mark = (active) => active ? "[x]" : "[ ]";
    const choice = await promptMenu(t(config, "inputTitle"), [
      { label: `${mark(inputMode === "auto")} auto`, value: "auto" },
      { label: `${mark(inputMode === "raw")} raw`, value: "raw" },
      { label: `${mark(inputMode === "line")} line`, value: "line" },
      { label: t(config, "back"), value: "exit" }
    ]);
    if (choice === "exit") return;

    const nextConfig = loadConfig();
    nextConfig.controls = { ...DEFAULT_CONFIG.controls, ...(nextConfig.controls || {}), inputMode: choice };
    saveConfig(nextConfig);
  }
}

async function languageSettingsMenu() {
  while (true) {
    const config = loadConfig();
    const language = langOf(config);
    const mark = (active) => active ? "[x]" : "[ ]";
    const choice = await promptMenu(t(config, "langTitle"), [
      { label: `${mark(language === "ru")} Русский`, value: "ru" },
      { label: `${mark(language === "en")} English`, value: "en" },
      { label: t(config, "back"), value: "exit" }
    ]);
    if (choice === "exit") return;

    const nextConfig = loadConfig();
    nextConfig.ui = { ...DEFAULT_CONFIG.ui, ...(nextConfig.ui || {}), language: choice };
    saveConfig(nextConfig);
  }
}

async function proxySettingsMenu() {
  while (true) {
    const config = loadConfig();
    const proxyUrl = getProxyUrl(config) || "off";
    const choice = await promptMenu(t(config, "proxyTitle"), [
      { label: `${t(config, "currentProxy")}: ${proxyUrl}`, value: "noop" },
      { label: t(config, "setProxy"), value: "set" },
      { label: t(config, "clearProxy"), value: "clear" },
      { label: t(config, "back"), value: "exit" }
    ]);
    if (choice === "exit") return;
    if (choice === "noop") continue;

    const nextConfig = loadConfig();
    nextConfig.network = { ...DEFAULT_CONFIG.network, ...(nextConfig.network || {}) };
    if (choice === "set") {
      const url = await ask(t(config, "proxyPrompt"));
      if (url) nextConfig.network.proxyUrl = url.trim();
    }
    if (choice === "clear") {
      nextConfig.network.proxyUrl = "";
    }
    saveConfig(nextConfig);
  }
}

async function settingsMenu() {
  while (true) {
    const config = loadConfig();
    const cookieBrowser = config.browserPlayer?.cookieBrowser || "auto";
    const inputMode = config.controls?.inputMode || "auto";
    const proxyUrl = getProxyUrl(config) || "off";
    const language = langOf(config);

    const choice = await promptMenu(t(config, "settingsTitle"), [
      { label: `${t(config, "settingsBackend")}: mpv`, value: "backend" },
      { label: `${t(config, "settingsMethod")}: ${getPlaybackMethod(config)}`, value: "method" },
      { label: `${t(config, "settingsPlayback")}: ${getPlaybackMode(config)}`, value: "playback" },
      { label: `${t(config, "settingsInput")}: ${inputMode}`, value: "input" },
      { label: `${t(config, "settingsLanguage")}: ${language === "en" ? "English" : "Русский"}`, value: "language" },
      { label: `${t(config, "settingsProxy")}: ${proxyUrl}`, value: "proxy" },
      { label: t(config, "back"), value: "exit" }
    ]);

    if (choice === "exit") return;
    if (choice === "backend") await backendSettingsMenu();
    if (choice === "method") await methodSettingsMenu();
    if (choice === "playback") await playbackSettingsMenu();
    if (choice === "input") await inputSettingsMenu();
    if (choice === "language") await languageSettingsMenu();
    if (choice === "proxy") await proxySettingsMenu();
  }
}

function isNetworkAccessError(error) {
  const message = String(error?.message || error || "");
  return /fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|network error|aborted|SoundCloud не открывается|SoundCloud.*not.*open/i.test(message);
}

async function handleInteractiveError(error) {
  const config = loadConfig();
  const en = langOf(config) === "en";
  console.log("");
  if (isNetworkAccessError(error)) {
    console.log(en ? "Network problem: SoundCloud did not respond." : "Проблема с сетью: SoundCloud не ответил.");
    console.log(en ? "Turn on VPN/proxy or check that SoundCloud opens in the browser, then try again." : "Включи VPN/прокси или проверь, что SoundCloud открывается в браузере, потом попробуй снова.");
    console.log(en ? `Proxy can be set in Settings -> Proxy. Current config: ${CONFIG_PATH}` : `Прокси можно указать в Настройки -> Прокси. Текущий конфиг: ${CONFIG_PATH}`);
  } else {
    console.log(`${en ? "Error" : "Ошибка"}: ${error.message}`);
  }
  await waitForEnter(t(config, "pressEnterMenu"));
}

async function interactiveMenu() {
  while (true) {
    const configForUi = loadConfig();
    const choice = await promptMenu("SoundCloud Random Music", [
      { label: t(configForUi, "mainPlay"), value: "play" },
      { label: t(configForUi, "mainAdd"), value: "add" },
      { label: t(configForUi, "mainList"), value: "list" },
      { label: t(configForUi, "mainStats"), value: "stats" },
      { label: t(configForUi, "mainSettings"), value: "settings" },
      { label: t(configForUi, "mainClearPlayed"), value: "clear-played" },
      { label: t(configForUi, "mainClearBlacklist"), value: "clear-blacklist" },
      { label: t(configForUi, "mainExit"), value: "exit" }
    ]);

    if (choice === "play") {
      try {
        await runPlayer(null);
      } catch (error) {
        await handleInteractiveError(error);
      }
      continue;
    }
    if (choice === "exit") return;
    if (choice === "add") {
      const configForPrompt = loadConfig();
      const name = await ask(t(configForPrompt, "sourceName"), "likes");
      const url = await ask(t(configForPrompt, "sourceUrl"));
      if (url) {
        const config = loadConfig();
        config.sources = config.sources.filter((source) => source.name !== name);
        config.sources.push({ name, url: normalizeSoundCloudUrl(url), enabled: true });
        saveConfig(config);
        console.log(`${t(config, "added")}: ${name}`);
      }
      await waitForEnter(t(loadConfig(), "pressEnterMenu"));
    }
    if (choice === "list") {
      const config = loadConfig();
      console.log(`config.json: ${CONFIG_PATH}`);
      console.log(`defaultSource: ${config.defaultSource}`);
      console.log(`backend: ${config.browserPlayer?.backend || "mpv"}`);
      console.log(`cookiesBrowser: ${config.browserPlayer?.cookieBrowser || "auto"}`);
      console.log(`playbackMethod: ${getPlaybackMethod(config)}`);
      console.log(`language: ${langOf(config)}`);
      console.log(`inputMode: ${config.controls?.inputMode || "auto"}`);
      console.log("");
      config.sources.forEach((source, index) => console.log(`${index + 1}. [${source.enabled === false ? "off" : "on"}] ${source.name} — ${source.url}`));
      await waitForEnter(t(config, "pressEnterMenu"));
    }
    if (choice === "stats") {
      printStats();
      await waitForEnter(t(loadConfig(), "pressEnterMenu"));
    }
    if (choice === "settings") {
      await settingsMenu();
    }
    if (choice === "clear-played") {
      const state = loadState();
      state.played = [];
      saveState(state);
      console.log(t(loadConfig(), "playedCleared"));
      await waitForEnter(t(loadConfig(), "pressEnterMenu"));
    }
    if (choice === "clear-blacklist") {
      const state = loadState();
      state.blacklist = [];
      saveState(state);
      console.log(t(loadConfig(), "blacklistCleared"));
      await waitForEnter(t(loadConfig(), "pressEnterMenu"));
    }
  }
}

async function runDiagnose() {
  const config = loadConfig();
  console.log(`config.json: ${CONFIG_PATH}`);
  console.log(`proxyUrl: ${getProxyUrl(config) || "off"}`);

  const tests = [
    ["SoundCloud homepage", "https://soundcloud.com/"],
    ["SoundCloud API", `${API_BASE}/resolve?url=https://soundcloud.com/arx_1&client_id=${config.cache?.clientId || "missing"}`]
  ];

  for (const [name, url] of tests) {
    try {
      const started = Date.now();
      const response = await fetchWithRetry(url, { kind: name.includes("API") ? "json" : "html" });
      console.log(`${name}: HTTP ${response.status}, ${Date.now() - started} ms`);
    } catch (error) {
      console.log(`${name}: FAIL — ${error.message}`);
    }
  }

  try {
    const id = await findWebClientId({ refresh: true });
    console.log(`client_id: ${appLanguage() === "en" ? "found and saved" : "найден и сохранён"} (${id.slice(0, 6)}...)`);
  } catch (error) {
    console.log(`client_id: FAIL — ${error.message}`);
  }
}

async function handleConfigCommands() {
  const config = loadConfig();

  if (hasFlag("--config-path")) { console.log(CONFIG_PATH); return true; }
  if (hasFlag("--init-config")) {
    if (!existsSync(CONFIG_PATH)) saveConfig({ ...structuredClone(DEFAULT_CONFIG), sources: [{ name: "likes", url: "https://soundcloud.com/arx_1/likes", enabled: true }] });
    console.log(`config.json: ${CONFIG_PATH}`);
    return true;
  }
  if (hasFlag("--show-config")) { console.log(JSON.stringify(config, null, 2)); return true; }
  if (hasFlag("--stats")) { printStats(); return true; }
  if (hasFlag("--show-state")) { console.log(JSON.stringify(loadState(), null, 2)); return true; }
  if (hasFlag("--clear-played")) { const state = loadState(); state.played = []; saveState(state); console.log(t(config, "playedCleared")); return true; }
  if (hasFlag("--clear-blacklist")) { const state = loadState(); state.blacklist = []; saveState(state); console.log(t(config, "blacklistCleared")); return true; }
  if (hasFlag("--list")) {
    console.log(`config.json: ${CONFIG_PATH}`);
    console.log(`defaultSource: ${config.defaultSource}`);
    console.log(`player: ${config.player}`);
    console.log(`backend: ${config.browserPlayer?.backend || "mpv"}`);
    console.log(`playbackMethod: ${getPlaybackMethod(config)}`);
    console.log(`playbackMode: ${getPlaybackMode(config)}`);
    console.log(`proxyUrl: ${config.network?.proxyUrl || "off"}`);
    console.log("");
    config.sources.forEach((source, index) => console.log(`${index + 1}. [${source.enabled === false ? "off" : "on"}] ${source.name} — ${source.url}`));
    return true;
  }
  if (hasFlag("--proxy")) {
    const proxyUrl = valueOf("--proxy");
    if (!proxyUrl) throw new Error("Формат: srm --proxy http://127.0.0.1:7890");
    try { new URL(proxyUrl); } catch { throw new Error("Некорректный proxy URL."); }
    config.network = { ...DEFAULT_CONFIG.network, ...(config.network || {}), proxyUrl };
    saveConfig(config);
    console.log(`proxyUrl: ${proxyUrl}`);
    return true;
  }
  if (hasFlag("--clear-proxy")) {
    config.network = { ...DEFAULT_CONFIG.network, ...(config.network || {}), proxyUrl: "" };
    saveConfig(config);
    console.log(langOf(config) === "en" ? "proxyUrl cleared" : "proxyUrl очищен");
    return true;
  }
  if (hasFlag("--browser-player")) {
    config.browserPlayer = { ...DEFAULT_CONFIG.browserPlayer, ...(config.browserPlayer || {}), backend: "mpv", enabled: false };
    config.network = { ...DEFAULT_CONFIG.network, ...(config.network || {}), openBrowserOnPlaybackFail: false };
    saveConfig(config);
    console.log("browserPlayer: off");
    return true;
  }

  if (hasFlag("--backend")) {
    const mode = String(valueOf("--backend") || "").toLowerCase();
    if (mode !== "mpv") throw new Error("Начиная с 2.11.0 поддерживается только backend mpv. Браузер больше не открывается.");
    config.browserPlayer = { ...DEFAULT_CONFIG.browserPlayer, ...(config.browserPlayer || {}), backend: "mpv", enabled: false };
    config.network = { ...DEFAULT_CONFIG.network, ...(config.network || {}), openBrowserOnPlaybackFail: false };
    saveConfig(config);
    console.log("backend: mpv");
    return true;
  }
  if (hasFlag("--language") || hasFlag("--lang")) {
    const language = String(valueOf("--language") || valueOf("--lang") || "").toLowerCase();
    if (!["ru", "en", "russian", "english"].includes(language)) throw new Error("Format: srm --language ru/en");
    const normalized = language === "english" ? "en" : language === "russian" ? "ru" : language;
    config.ui = { ...DEFAULT_CONFIG.ui, ...(config.ui || {}), language: normalized };
    saveConfig(config);
    console.log(`language: ${normalized}`);
    return true;
  }
  if (hasFlag("--input")) {
    const mode = String(valueOf("--input") || "").toLowerCase();
    if (!["auto", "raw", "line"].includes(mode)) throw new Error("Формат: srm --input auto/raw/line");
    config.controls = { ...DEFAULT_CONFIG.controls, ...(config.controls || {}), inputMode: mode };
    saveConfig(config);
    console.log(`inputMode: ${mode}`);
    return true;
  }
  if (hasFlag("--safe-mode")) {
    config.playback = { ...DEFAULT_CONFIG.playback, ...(config.playback || {}), method: "smart", mode: "auto" };
    config.browserPlayer = { ...DEFAULT_CONFIG.browserPlayer, ...(config.browserPlayer || {}), backend: "mpv", enabled: false, cookieBrowser: "off" };
    config.player = "mpv";
    config.controls = { ...DEFAULT_CONFIG.controls, ...(config.controls || {}), inputMode: "auto" };
    saveConfig(config);
    console.log(langOf(config) === "en" ? "Recommended mode enabled:" : "Включён рекомендованный режим:");
    console.log("method: smart");
    console.log("cookiesBrowser: off");
    console.log("playback: auto (stream -> temp download)");
    console.log("player: mpv");
    return;
  }

  if (hasFlag("--method")) {
    const method = String(valueOf("--method") || "").toLowerCase();
    if (!["smart", "soundcloud-api-first", "yt-dlp-first"].includes(method)) {
      throw new Error("Format: srm --method smart/soundcloud-api-first/yt-dlp-first");
    }
    config.playback = { ...DEFAULT_CONFIG.playback, ...(config.playback || {}), method };
    saveConfig(config);
    console.log(`playbackMethod: ${method}`);
    return true;
  }
  if (hasFlag("--playback")) {
    const mode = String(valueOf("--playback") || "").toLowerCase();
    if (!["auto", "stream", "download-temp"].includes(mode)) {
      throw new Error("Формат: srm --playback auto/stream/download-temp");
    }
    config.playback = { ...DEFAULT_CONFIG.playback, ...(config.playback || {}), mode };
    saveConfig(config);
    console.log(`playbackMode: ${mode}`);
    return true;
  }
  if (hasFlag("--reset-client-id")) {
    config.cache = { ...(config.cache || {}), clientId: "", clientIdUpdatedAt: "" };
    saveConfig(config);
    cachedClientId = null;
    const id = await findWebClientId({ refresh: true });
    console.log(`${langOf(config) === "en" ? "client_id refreshed" : "client_id обновлён"}: ${id.slice(0, 6)}...`);
    return true;
  }
  if (hasFlag("--diagnose")) {
    await runDiagnose();
    return true;
  }
  if (hasFlag("--add")) {
    const addValue = valueOf("--add");
    const [name, rawUrl] = Array.isArray(addValue) ? addValue : [addValue, parsed.positional[0]];
    if (!name || !rawUrl) throw new Error("Формат: srm --add name https://soundcloud.com/user/likes");
    const next = config.sources.filter((source) => source.name !== name);
    next.push({ name, url: normalizeSoundCloudUrl(rawUrl), enabled: true });
    config.sources = next;
    saveConfig(config);
    console.log(`${t(config, "added")}: ${name}`);
    return true;
  }
  if (hasFlag("--remove")) {
    const name = valueOf("--remove");
    config.sources = config.sources.filter((source) => source.name !== name);
    if (config.defaultSource === name) config.defaultSource = "all";
    saveConfig(config);
    console.log(`${langOf(config) === "en" ? "Removed" : "Удалено"}: ${name}`);
    return true;
  }
  if (hasFlag("--default")) {
    const name = valueOf("--default");
    if (name !== "all" && !config.sources.some((source) => source.name === name)) throw new Error(`${langOf(config) === "en" ? "Source not found" : "Источник не найден"}: ${name}`);
    config.defaultSource = name;
    saveConfig(config);
    console.log(`defaultSource: ${name}`);
    return true;
  }
  if (hasFlag("--player") && parsed.positional.length === 0) {
    const player = valueOf("--player");
    if (!["auto", "mpv", "ffplay", "vlc"].includes(player)) throw new Error("player должен быть: auto, mpv, ffplay или vlc");
    config.player = player;
    saveConfig(config);
    console.log(`player: ${player}`);
    return true;
  }
  return false;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) { showHelp(); return; }
  if (hasFlag("--version")) { console.log(VERSION); return; }
  if (hasFlag("--demo")) { await runDemo(); return; }
  if (await handleConfigCommands()) return;

  const explicitUrl = parsed.positional[0] || null;
  if (!explicitUrl && !existsSync(CONFIG_PATH)) {
    console.log(langOf(loadConfig()) === "en" ? "Config does not exist yet. Creating example..." : "Конфиг ещё не создан. Создаю пример...");
    saveConfig({ ...structuredClone(DEFAULT_CONFIG), sources: [{ name: "likes", url: "https://soundcloud.com/arx_1/likes", enabled: true }] });
  }
  if (!explicitUrl && process.stdin.isTTY && !hasFlag("--play")) {
    await interactiveMenu();
    return;
  }
  await runPlayer(explicitUrl);
}

main().catch((error) => {
  console.error(`\n${tt("settingsLanguage") === "Language" ? "Error" : "Ошибка"}: ${error.message}`);
  process.exitCode = 1;
});
