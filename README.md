# SoundCloud Random Music

**SoundCloud Random Music** — маленький терминальный плеер для SoundCloud.

Он берёт публичные лайки или плейлисты SoundCloud, выбирает случайный трек и запускает его через `mpv`.
Проект сделан в первую очередь под Windows и запускается одной кнопкой через `start.bat`.

Главная идея простая:
**открыл папку → нажал `start.bat` → играет случайная музыка из SoundCloud.**

---

## Что умеет

* запускать случайный трек из SoundCloud likes;
* работать с публичными плейлистами;
* поддерживать несколько источников сразу;
* переключать треки;
* возвращаться на предыдущий трек;
* ставить паузу;
* включать/выключать повтор;
* менять громкость;
* показывать прогресс трека;
* показывать оставшееся время;
* вести статистику прослушивания;
* запоминать уже прослушанные треки;
* добавлять нерабочие треки в чёрный список;
* заранее подгружать следующий трек;
* хранить настройки внутри папки программы.

---

## Как выглядит управление

Во время музыки внизу появляется меню:

```txt
Играет 0:42/2:30 -1:48 [###-------] | [Дальше] Назад Пауза Повт:выкл Звук:80% Меню | S:3
```

Управление:

```txt
Стрелки влево/вправо — выбрать пункт
Enter — нажать выбранный пункт
```

---

## Структура папки

Проект сделан максимально просто:

```txt
soundcloud-random-music-windows
├─ start.bat
└─ main
```

`start.bat` — главный файл запуска.
`main` — сама программа и её данные.

Настройки и история хранятся внутри:

```txt
main/data
```

---

## Требования

Перед запуском нужно установить:

### Node.js

Нужен для работы программы.

Скачать можно с официального сайта:

```txt
https://nodejs.org/
```

Проверка:

```powershell
node --version
npm --version
```

---

### mpv

Нужен для проигрывания музыки.

Установка через PowerShell:

```powershell
winget install -e --id shinchiro.mpv --source winget
```

Проверка:

```powershell
mpv --version
```

Если Windows не видит `mpv`, обычно он лежит здесь:

```txt
C:\Program Files\MPV Player\mpv.com
```

---

### yt-dlp

Нужен как запасной способ получения аудио из SoundCloud.

Установка:

```powershell
winget install -e --id yt-dlp.yt-dlp --source winget
```

Проверка:

```powershell
yt-dlp --version
```

---

## Запуск

1. Скачать архив.
2. Распаковать папку.
3. Открыть папку `soundcloud-random-music-windows`.
4. Запустить:

```txt
start.bat
```

При первом запуске программа сама установит npm-зависимости.

---

## Как добавить источник

В меню выбери:

```txt
Добавить источник
```

Можно добавить ссылку на лайки:

```txt
https://soundcloud.com/arx121/likes
```

или на плейлист:

```txt
https://soundcloud.com/arx121/sets/playlist-name
```

---

## Что хранится в data

В папке:

```txt
main/data
```

хранятся:

```txt
config.json
state.json
```

Там лежат:

* добавленные источники;
* громкость;
* настройки получения аудио;
* история;
* список прослушанных треков;
* чёрный список;
* статистика.

---

## Важное ограничение

SoundCloud иногда не отдаёт некоторые треки обычным способом.
Бывает так, что трек открывается в браузере, но не запускается через терминал.

Программа пытается обойти это несколькими способами:

```txt
SoundCloud stream API
yt-dlp
yt-dlp + cookies
```

Если трек всё равно не работает, он добавляется в чёрный список, и программа берёт следующий.

---

## Рекомендуемые настройки

Обычно лучше оставить метод:

```txt
smart
```

Он сам пробует несколько способов получения аудио.

---

## Команды

Статистика:

```powershell
srm --stats
```

Показать настройки:

```powershell
srm --show-config
```

Очистить прослушанные:

```powershell
srm --clear-played
```

Очистить чёрный список:

```powershell
srm --clear-blacklist
```

---

## GitHub About

```txt
Random SoundCloud music player for public likes and playlists. Works through terminal with mpv, yt-dlp fallback, queue, stats, volume control and portable data.
```

---

## Topics

```txt
soundcloud
music-player
terminal
cli
mpv
yt-dlp
nodejs
windows
powershell
random-music
playlist
portable
```

---

## .gitignore

```gitignore
node_modules/
npm-debug.log*
.DS_Store

main/data/config.json
main/data/state.json
main/data/cache/
main/data/temp/

.env
```

Если хочешь оставить пустую папку `data` в репозитории, добавь туда файл:

```txt
.gitkeep
```

---

## Название релиза

```txt
SoundCloud Random Music Windows
```

## Описание релиза

```txt
Portable Windows version of SoundCloud Random Music.

Features:
- random playback from SoundCloud likes and playlists
- mpv playback
- yt-dlp fallback
- smart audio resolving
- previous/current/next queue
- next track preload
- volume control
- pause and repeat
- blacklist for broken tracks
- played history
- session stats
- portable data inside main/data
```

---

## Загрузка на GitHub

```powershell
cd "D:\dowloadW\soundcloud-random-music-windows"
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/arx121/soundcloud-random-music.git
git push -u origin main
```
