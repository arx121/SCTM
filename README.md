# 🎵 SoundCloud Random Music
A simple Windows terminal player that plays random tracks from SoundCloud likes and public playlists.
Open the folder, run `start.bat`, add your sources, and listen.  
No browser windows, no ads, no extra noise — just music.
## Language
- 🇬🇧 English: `README.md`
- 🇷🇺 Russian: `README_RU.md`
## 🚀 Quick Start
1. Download and extract the project archive.
2. Open the folder:
   ```txt
   soundcloud-random-music-windows

3. Run:

start.bat

On the first launch, the app will install the required project dependencies automatically.

📦 Requirements

Install these once:

1. Node.js LTS

Download Node.js LTS from:

https://nodejs.org/

2. mpv player

Install mpv through Windows Terminal / PowerShell:

winget install -e --id shinchiro.mpv

3. yt-dlp

The launcher can install it automatically, or you can install it manually:

winget install -e --id yt-dlp.yt-dlp

⭐ Features

* Random playback from SoundCloud likes and public playlists
* Multiple sources in one mixed session
* Next / Previous / Pause / Repeat controls
* Working volume control
* Progress bar with remaining time
* Listening history
* Track blacklist for broken or unavailable tracks
* Next-track preloading for smoother playback
* Smart mode for more reliable track detection
* Portable data storage: settings, history and cache stay inside the app folder

➕ How to Add Music

Inside the app:

Add source → enter name → paste SoundCloud link

Examples:

https://soundcloud.com/your_nick/likes
https://soundcloud.com/your_nick/sets/playlist-name

Supported sources:

* Public likes
* Public playlists

Private tracks and private playlists may not work.

🎛️ Controls

While music is playing, use the bottom action bar.

Controls:

← / →  Select action
Enter  Confirm

Available actions:

Next · Back · Pause · Repeat · Volume · Menu

🧠 Smart Mode

Smart mode is the most reliable way to find playable tracks.

It may work a little slower, but it usually handles SoundCloud pages better than the faster methods.

Recommended mode:

Smart

📁 Portable Storage

The app keeps its data inside the project folder.

This includes:

* settings
* history
* blacklist
* cached/preloaded data

Nothing important is stored in AppData.

🛠️ Troubleshooting

Track does not play

Some SoundCloud tracks may be private, deleted, region-blocked or unavailable.

The app can add broken tracks to the blacklist so they will not keep repeating.

Music overlaps after switching tracks

Make sure you are using the latest version of the app.
The player should stop the previous mpv process before starting the next track.

Two very short tracks play in a row

If two tracks shorter than 30 seconds play one after another, restart the app.
This usually means SoundCloud returned previews or invalid tracks instead of full songs.

mpv is not found

Install mpv:

winget install -e --id shinchiro.mpv

Then restart the app.

📌 Notes

This project is made for personal music playback from public SoundCloud pages.

It is not an official SoundCloud client.
