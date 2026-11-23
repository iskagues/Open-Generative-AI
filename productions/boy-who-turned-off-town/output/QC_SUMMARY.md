# QC summary — The Boy Who Turned Off the Town

Measured on the final files with ffprobe / ffmpeg ebur128. Nothing below is estimated.

| Check | Target | Result |
|---|---|---|
| Resolution / aspect | 1080×1920, 9:16 | 1080×1920 ✔ |
| Frame rate | 30 fps | 30/1, 2083 frames ✔ |
| Duration | 68–70 s | 69.42 s ✔ |
| Video codec | H.264 | H.264 High, yuv420p ✔ |
| Audio | AAC 48 kHz stereo | AAC 48 kHz 2 ch ✔ |
| Integrated loudness | −14 LUFS | −14.0 LUFS ✔ |
| True peak | < −1 dBTP | −1.5 dBTP ✔ |
| Narration words aligned | all | 178/178 (new voice v2) by forced alignment (faster-whisper), 0 interpolated ✔ |
| Captions | word-by-word, #FFE033 Anton, black outline | 179 events, never two words on screen at once ✔ |
| Emphasis words | DARK, STOP!, CLICK, STARS, NOBODY | larger pop + heavier outline (DARK orange-tint, CLICK white) ✔ |

## Files
- `the_boy_who_turned_off_the_town.mp4`: master copy (CRF 17, ~38 Mb/s, 330 MB). Not committed to git because GitHub rejects files over 100 MB; rebuild it with `scripts/05_assemble.sh`.
- `the_boy_who_turned_off_the_town_web.mp4`: delivery copy (2-pass 9.5 Mb/s, 85 MB). The image and audio match the master.
- `voiceover.wav`, `music_score.wav`, `final_mix.wav`, `captions.srt`, `captions_animated.ass`, `word_timing.csv`, `shot_timeline.json`

## Visual QC
- Every shot was checked on frames taken from the final MP4 (a 28-frame contact sheet, plus full-resolution frames at DARK, STOP!, CLICK and the comet).
- Fix made after the final render: in the S11 note close-up (47.7–50.1 s) the captions covered the handwritten note. Those 7 words now sit lower, on the table under the note.

## Honest notes
- No reference video was attached to the request, so the film follows the written spec, script and storyboard only.
- Everything was made locally:
  - **Picture:** procedural three.js scenes rendered frame by frame in headless Chromium using software GL.
  - **Voices (v2):** Chatterbox, an open-weights expressive TTS model (MIT licence). Each line has its own emotion intensity, and the narrator and Noah timbres are cloned from Kokoro-82M reference clips (an open model, not a real person). There are 3 takes per line and the best one is picked by speech-recognition match. A clean voice chain is applied: high-pass, EQ, de-esser, light compression, and no pitch shifting. Every line keeps its original start time, so the picture stays in sync: 25 of 27 lines needed no stretching, and the others at most ×1.13. Chatterbox adds an inaudible provenance watermark (Perth) to its audio.
  - **Score and sound effects:** synthesized in numpy.
- No paid generative video service was used, and no third-party footage, music or game assets are included. Characters, town, score and motif are original.
- The style is blocky avatar animation in the spirit of Roblox. It is simple real-time 3D, not a high-end Pixar-style render.
