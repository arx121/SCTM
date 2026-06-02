# 🎵 SoundCloud Random Music

**Cozy terminal player that just throws random music from SoundCloud at you.**

Open the folder → double-click `start.bat` → and the vibe starts immediately. No browsers, no ads, no extra windows. Just you, your likes and playlists, and music that picks itself.

## How it works
You add your public SoundCloud likes or playlists, and the program randomly picks a track and plays it every time. Perfect when you’re too lazy to search but just want to listen.

## What you need to install (once and forever)
To make everything work like a charm, you’ll need three things. Don’t panic — it takes a couple of minutes via PowerShell:

1. **Node.js**  
   The engine without which nothing works.  
   Download and install from the official site: [https://nodejs.org/](https://nodejs.org/) (take the LTS version).  
   Check: `node --version` and `npm --version`.

2. **mpv**  
   A proper music player.  
   ```powershell
   winget install -e --id shinchiro.mpv
After that just run start.bat — on the first launch it will automatically download all npm dependencies and you’re good to go.
Features
•  Random playback from likes and public playlists
•  You can add as many sources as you want
•  Next / previous track, pause, repeat, volume control
•  Nice progress bar and remaining time
•  Blacklist for tracks that refuse to play
•  Listening history
•  Preloading the next track (no pauses)
•  Fully portable — all settings and data stay inside the folder
How to run (literally 10 seconds)
1.  Download and extract the archive
2.  Open the folder soundcloud-random-music-windows
3.  Run start.bat
How to add your tracks
Inside the program choose Add source, give it a name and paste the link:
Examples:
•  Likes: https://soundcloud.com/your_nick/likes
•  Playlist: https://soundcloud.com/your_nick/sets/playlist-name
You can mix as many as you want.
Recommendations
Set the mode to smart — it’s the smartest and most reliable, but works a bit slower. It tries everything until it finds a working audio stream.
Controls
While playing, the bottom line shows actions. Use Left / Right arrows to select, Enter to confirm.
Available: Next, Back, Pause, Repeat, Volume, Menu.