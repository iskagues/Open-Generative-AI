# Everybody Husses (Except Me)

A vertical (1080×1920, 30 fps) blocky-avatar story short, about 70 s long, in English. It uses the "In this town, everybody ___. Except me." format with the viral **HUSS!** catchphrase. The story is new and original.

**Story.** Leo is the only person in town who can't huss: when he tries, he squeaks. Every summer his town loses the tug of war against Mudville, face first into the mud. This year the captain needs one more player. Leo tries chili, then tutorials, then trains every night by pulling Grandma's car and the ice cream truck, with the driver asleep inside. In the final seconds, seven nights of saved-up huss come out at once. Mudville flies over his team's heads, does a full loop, and lands in its own mud. The video ends on the whole town chanting HUSS! HUSS! HUSS!

## Pipeline
| step | script | output |
|---|---|---|
| crowd chant | `scripts/00_crowd_huss.py` (Kokoro, 14 synthetic voices × 2) | `build/crowd_huss.wav` |
| voice takes | `~/cbx/bin/python scripts/01a_voice_takes.py` (Chatterbox, 3 takes/line, per-line emotion, built-in human voice) | `build/vo3/` |
| voice build | `VO_DIR=vo3 WPM=165 TARGET_MAX=95 python3 scripts/01b_voice_build.py` | `build/voice.wav`, `words.json` |
| cuts | `python3 scripts/02_timeline.py` (60 word-anchored cuts) | `build/timeline.json` |
| sound + mix | `python3 scripts/03_audio.py` | `build/sfx.wav`, `mix.wav`, `music_bed.wav` |
| captions | `python3 scripts/04_captions.py` | `build/captions.ass` |
| picture | `scripts/render_all.sh` (three.js + Playwright, resumable) | `build/picture.mp4` |
| deliver | `scripts/05_assemble.sh` | `output/` |

## Voice
- **Leo, the narrator (v2).** Chatterbox's built-in default voice (no cloning of a synthetic reference), acted line by line with its own exaggeration per line (curiosity, embarrassment, suspense, comedy, explosion, triumph). No time-stretch: natural pace ~185 wpm. Light de-ess + 2:1 compression only. Pitch range ~16–17 semitones vs ~8–12 in v1, so it sounds far less robotic.
- **Ava, the captain.** Kokoro `af_sky`.
- Both voices are synthetic. Neither is cloned from any real person or from the reference video. The output carries Chatterbox's inaudible Perth watermark.

## Music
`build/music/track.wav` is the track the user supplied, "In This Town – Dreamcore (Roblox Nostalgia)". It is not committed to the repo, and publishing rights are the uploader's responsibility. It sits about 13 LU under the voice and ducks while the narrator speaks.
