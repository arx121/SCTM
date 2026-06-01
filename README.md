Language: English | [Русский](README.ru.md)

# SoundCloud Random Music

**SoundCloud Random Music** is a small terminal player for SoundCloud.

It plays random tracks from public SoundCloud likes or playlists.
The Windows version is portable and starts with one file:

```txt
start.bat
```

The idea is simple:

```txt
open folder -> run start.bat -> random SoundCloud music starts
```

---

## Features

* random playback from SoundCloud likes;
* random playback from public SoundCloud playlists;
* support for multiple sources;
* next / previous track;
* pause and resume;
* repeat mode;
* volume control;
* progress bar;
* remaining time;
* listening statistics;
* blacklist for broken tracks;
* played history;
* next track preloading;
* portable settings inside the project folder.

---

## Requirements

Before running the program, install these dependencies.

### 1. Node.js

Required to run the program.

Download:

```txt
https://nodejs.org/
```

Check installation:

```powershell
node --version
npm --version
```

---

### 2. mpv

Required to play audio.

Install with PowerShell:

```powershell
winget install -e --id shinchiro.mpv --source winget
```

Check installation:

```powershell
mpv --version
```

If Windows cannot find `mpv`, it is usually installed here:

```txt
C:\Program Files\MPV Player\mpv.com
```

---

### 3. yt-dlp

Used as a fallback method for getting audio from SoundCloud.

Install with PowerShell:

```powershell
winget install -e --id yt-dlp.yt-dlp --source winget
```

Check installation:

```powershell
yt-dlp --version
```

---

## How to Run

1. Download the project.
2. Extract the folder.
3. Open the folder:

```txt
soundcloud-random-music-windows
```

4. Run:

```txt
start.bat
```

On the first launch, the program will install npm dependencies automatically.

---

## Folder Structure

```txt
soundcloud-random-music-windows
├─ start.bat
└─ main
```

User data is stored here:

```txt
main/data
```

This folder contains:

```txt
config.json
state.json
```

---

## How to Add Likes or Playlists

Open the program and choose:

```txt
Add source
```

Then enter a name for the source and paste a SoundCloud link.

### Public likes example

```txt
https://soundcloud.com/username/likes
```

### Public playlist example

```txt
https://soundcloud.com/username/sets/playlist-name
```

You can add several sources.
The program can randomly choose tracks from all enabled sources.

---

## Recommended Settings

The recommended audio method is:

```txt
smart
```

It tries several ways to get playable audio:

```txt
SoundCloud stream API
yt-dlp
yt-dlp + cookies
```

If one method fails, the program tries another one.

---

## Controls

During playback, the bottom line looks like this:

```txt
Playing 0:42/2:30 -1:48 [###-------] | [Next] Back Pause Repeat:off Volume:80% Menu | S:3
```

Controls:

```txt
Left / Right arrows - select action
Enter - confirm selected action
```

Available actions:

```txt
Next
Back
Pause
Repeat
Volume
Menu
```

---

## Useful Commands

Show statistics:

```powershell
srm --stats
```

Show current config:

```powershell
srm --show-config
```

Clear played tracks:

```powershell
srm --clear-played
```

Clear blacklist:

```powershell
srm --clear-blacklist
```

Set audio method:

```powershell
srm --method smart
```

---

## Notes

SoundCloud does not always provide every track in a terminal-friendly way.

Sometimes a track may work in the browser but fail in the terminal.
If a track cannot be played, the program adds it to the blacklist and chooses another one.
