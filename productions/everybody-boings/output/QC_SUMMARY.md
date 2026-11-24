# QC: Everybody Boings (Except Me)

Measured on `everybody_boings_except_me.mp4` with ffprobe, ebur128 and librosa.

| Check | Reference video | This video |
|---|---|---|
| Format | 1080×1920, 24 fps, 62.4 s | 1080×1920, 30 fps, 63.5 s, H.264 + AAC 48 kHz stereo |
| Loudness | −14.2 LUFS | −14.0 LUFS, true peak −1.4 dBTP |
| Narrator | kid, median pitch ~252 Hz, ~234 wpm | kid, median pitch ~252 Hz, 234 wpm (244 words in 62.6 s) |
| Background music | none (only crowd and sound effects at the game) | none (sound effects, crowd only at the race) |
| Cutting | 67 cuts (~0.93 s each) | 64 cuts (~0.99 s each), every cut on a spoken word |
| Captions | one word at a time, white rounded bold, black outline, ~58% height | same style; word timing from forced alignment (244/244 words, 0 estimated) |

## Notes
- The story, characters, lines, places and sounds are all new and original. Only the style and the story formula follow the reference.
- No footage or audio from the reference is used. The voices are synthetic and are not cloned from the reference narrator.
- The voices come from Chatterbox, which adds an inaudible provenance watermark to its audio. There are no visible watermarks.
- All the sounds are generated in code. There is no music, as in the reference.
- In the two scoreboard shots, the captions sit a little lower so they don't cover the board.

## v2 (current master)
- Voice: new young-adult male storyteller (synthetic; Chatterbox cloning a Kokoro am_puck +3 st reference, median ~133 Hz), per-line emotion settings, best of 3–7 takes/line, dry studio chain (no reverb).
- Pace: 172 wpm overall (brief: 165–185), 243/244 words force-aligned.
- Music: user-supplied track "In This Town – Dreamcore (Roblox Nostalgia)", ~13 LU under the voice, 5 dB sidechain duck, 2.2 s fade-out. Third-party track: publishing rights are the uploader's responsibility.
- Duration 86.97 s, 1080x1920, 30 fps, 2609 frames.
- Loudness −14.0 LUFS integrated, true peak −1.6 dBTP.
- Captions re-timed to the new voice; lowered below the scoreboard on the two score cuts.
