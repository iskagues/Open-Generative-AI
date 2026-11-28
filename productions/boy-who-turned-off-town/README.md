# The Boy Who Turned Off the Town

A 69.4-second vertical (9:16) animated short, made entirely in this container with code: a procedural
blocky-avatar 3D world rendered with three.js, neural text-to-speech narration, an original synthesized
score and sound design, and word-by-word animated captions.

## Deliverables (`output/`)

| File | What it is |
|---|---|
| `the_boy_who_turned_off_the_town.mp4` | The finished short: 1080x1920, 30 fps, H.264 High, AAC 48 kHz stereo, captions burned in |
| `voiceover.wav` | Narration on its own (48 kHz, timeline-aligned) |
| `music_score.wav` | Original score on its own |
| `final_mix.wav` | Final mix (-14 LUFS integrated, true peak <= -1.5 dBTP) |
| `captions.srt` | Phrase-level subtitles for platform upload |
| `captions_animated.ass` | The animated word-by-word caption track that is burned in |
| `word_timing.csv` | Word-level timing taken from the generated narration |
| `shot_timeline.json` | Shot boundaries and story events (all anchored to spoken words) |

## Shot timeline

| Shot | Time (s) | Name | Picture | Narration |
|---|---|---|---|---|
| S01 | 0.00-4.81 | THE IMPOSSIBLE EVENT | Night aerial push-in over the lit town square; a flicker at 1.25 s, then total blackout synced to the word "DARK" with bass impact and crowd gasp. | Every night at exactly nine seventeen, our town square went DARK. |
| S02 | 4.81-11.80 | THE BLACKOUT MONTAGE | Montage: three streetlamps die one after another, the BAKERY neon cuts out, the golden mayor statue loses its uplights one by one; hard cut to the next sunny morning with everything working. | The streetlights. The shops. Even the mayor's ridiculous golden statue. And by morning? Everything worked again. |
| S03 | 11.80-15.60 | THE TOWN IS CONFUSED | Day: the mayor yells at two shrugging electricians; cut to the baker pointing at the sky while neighbours look up, confused. | The mayor blamed electricians. The baker blamed aliens. |
| S04 | 15.60-19.34 | THE SUSPECT | Leo close-up, smirk turning suspicious; over-the-shoulder slow zoom onto Noah standing alone in his mint-green hoodie while the townsfolk chatter around. | I blamed one kid. The quiet boy in the green hoodie. |
| S05 | 19.34-23.59 | THE MYSTERIOUS WALK | Night: low-angle tracking shot of Noah climbing the hill carrying the giant red switch; Leo peeks out from behind a tree. | Every night, I saw him climb the hill carrying a giant red switch. |
| S06 | 23.59-29.76 | THE PURSUIT | Friday pursuit: Leo leaves the square, sneaks through the playground, hurries along the tree path, arrives as Noah slips into the abandoned observatory (door creak). | So on Friday, I followed him. Past the playground. Through the trees. Into the abandoned observatory. |
| S07 | 29.76-34.12 | THE CONFRONTATION | Interior: Noah reaches for the switch; Leo shouts "STOP!" (camera punch-in + shake); Noah turns: "Please... just one minute." | He reached for the switch. I screamed, STOP! Please... just one minute. |
| S08 | 34.12-37.85 | THE SWITCH | Extreme close-up: Noah's hand pushes the red lever down, CLICK, sparks; instant cut to the aerial as the square goes dark in a ripple and stars appear. | The whole square disappeared into darkness. |
| S09 | 37.85-41.14 | THE MOMENT OF SILENCE | Silence: Leo's fists clench; Noah gently points up; camera follows his finger to the broken dome. | I was furious... Until he pointed upward. |
| S10 | 41.14-46.30 | THE SKY REVEAL | Sky reveal: tilt up through the dome to thousands of stars, then a wide low shot of the comet stretching across the sky. | Thousands of stars. A glowing comet stretching across the sky. |
| S11 | 46.30-52.76 | THE DRAWING | Push-in to the desk: Maya's crayon comet drawing, then the note "I want to see the sky sparkle." (legible, kept above the caption zone). | On his desk lay a crayon drawing of that same comet. Below it, a note: “I want to see the sky sparkle.” |
| S12 | 52.76-57.86 | THE HIDDEN REASON | Warm memory: Maya drawing the comet in her hospital bed with Noah beside her; then tonight, Noah walks her home under a WELCOME HOME MAYA! banner. | His little sister had been in the hospital all week. Tonight was her first night home. |
| S13 | 57.86-63.13 | THE REUNION | Terrace: Maya and Noah gaze at the comet, his hand on her shoulder; Leo's face shifts from anger to puzzlement to a soft smile; over-the-shoulder of the siblings under the comet. | He wasn't trying to ruin our nights. He was giving her one she would never forget. |
| S14 | 63.13-69.42 | THE FINAL EMOTIONAL PAYOFF | The dark square: residents quietly look up instead of complaining; final wide behind the three kids beneath the comet, the town peacefully dark below; fade on the musical tail. | And for the first time... Nobody asked him to turn the lights back on. |

## How it was made (and how to rebuild it)

Everything is deterministic and re-runnable from the `scripts/` and `render/` folders:

1. `python3 scripts/01_voice.py` - Kokoro-82M (ONNX) neural TTS, one phrase at a time with per-phrase
   tempo, gain and pitch performance (rubberband), hand-directed pauses, then faster-whisper word
   alignment against the generated audio. Every word was recognised back correctly (0 interpolated).
   Noah's line uses a second, softer voice and gets the observatory's room reverb in the mix.
2. `python3 scripts/02_timeline.py` - builds the edit: each cut and story event (blackout, CLICK,
   stars, comet...) is anchored to a word or phrase in the real narration.
3. `node render/driver.js render <first> <last> out.mp4` (or `scripts/render_all.sh`) - headless
   Chromium renders every frame of the three.js scene (`render/js/`): blocky characters with
   canvas-drawn expressive faces, the town square, hill, playground, observatory, hospital and home sets,
   a procedural sky shader (anti-aliased twinkling stars, milky band, moon, two-tailed comet), bloom,
   SMAA and a colour-grade pass. `node render/driver.js preview 12.5 40 ...` writes stills.
4. `python3 scripts/03_audio.py` - original score (plucked motif, sneaky pizzicato, pulse bass, drone,
   piano/pads/strings resolution of the same motif) and synthesized sound design (hum that withdraws
   at each blackout, lamp clicks, bass impacts, footsteps from the renderer's walk cycles, door creak,
   tension rise, the switch click with sparks, comet shimmer, crickets and wind). Music is
   sidechain-ducked under speech, then the mix is loudness-normalized and peak-limited.
5. `python3 scripts/04_captions.py` - captions built from the word timings: Anton, #FFE033, thick black
   outline, one word at a time with a 92% to 106-110% to 100% pop (varied), stronger hits on DARK,
   STOP!, CLICK!, STARS and NOBODY.
6. `scripts/05_assemble.sh` - burns captions, muxes audio, exports to `output/`.

Requirements: Python 3 with `kokoro-onnx soundfile faster-whisper scipy pyloudnorm`, the Kokoro model
files in `~/models` (kokoro-v1.0.onnx, voices-v1.0.bin), Node 22 with `three@0.170` in `render/`,
Playwright's Chromium, and ffmpeg with libass and rubberband.

## Notes

- No reference video was attached to the session, so the visual style follows the written spec.
- All characters, locations, music and sound are original; nothing is copied from an existing game,
  show or song. The blocky avatar look is generic, with no third-party logos or assets.
