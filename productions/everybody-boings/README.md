# Everybody Boings (Except Me)

An original 63-second vertical short (1080×1920, 30 fps). It is made in the same style as the reference video the user supplied, with a completely new story.
The analysis of the reference is in `../ref_analysis/ANALYSIS.md`.

## Story
In this town everybody "boings": they jump sky-high with a cartoon spring sound. Everybody except Milo, who used to boing the highest until his boing disappeared.

1. The doctor bans boinging for a month, a week before the Sky Race.
2. Milo tries sodas, spring shoes and Grandma's trampoline. Each one fails.
3. His cat boings better than him, and his best friend Zoe teases him from her rooftop party.
4. He trains in silence in the garage every night. For the first time in years, the mailman finishes his route.
5. At the race, the purple team boings so high they wave at airplanes. Ten seconds are left, the gap is huge, and Milo's push gives only "almost… almost…".
6. Seven nights of saved-up squats come out in one giant **BOING!** He high-fives a bird, lands on the finish line, the scoreboard falls over, and the ref's hat flies into the next town.

## Matching the reference style
| Aspect | Reference (measured) | This video |
|---|---|---|
| Format | 1080×1920, 62.4 s | 1080×1920, 63.5 s, 30 fps |
| Narration | first-person kid, ~252 Hz median pitch, ~234 wpm, dry and loud | first-person kid, ~252 Hz median pitch, 234 wpm, dry and close |
| Music | none; crowd and sound effects only at the climax | none; sparse sound effects, with the crowd only at the race |
| Cutting | 67 cuts, a cut every ~0.93 s | 64 cuts, a cut every ~0.99 s, each starting on a spoken word |
| Look | bright, flat, blocky avatars, pastel town, blue sky with puffy clouds | the same, procedural three.js scenes |
| Captions | one white rounded-bold word at a time, thin black outline, ~58% height, no animation | the same (Nunito ExtraBold) |
| Structure | hook → loss → doctor → remedies → humiliation → friend's party → silent training → big game → almost → comeback → absurd win → callback | the same formula, with new content |

## How it was made
1. `scripts/script.py` is the script. Each line has a speaker, an emotion intensity and the pause after it.
2. `scripts/01a_voice_takes.py` (run with the Chatterbox venv) makes 3–6 expressive takes per line.
   - Chatterbox is an open-weights TTS model under the MIT licence.
   - Milo's voice is a synthetic child voice: Kokoro af_nova raised 6 semitones, then cloned by Chatterbox. Zoe's comes from af_sky the same way.
   - Neither voice is cloned from the reference video.
   - Chatterbox embeds an inaudible Perth provenance watermark in its output.
3. `scripts/01b_voice_build.py` picks the best take of each line by speech-recognition accuracy and pace.
   - It cleans each take with high-pass, EQ, de-esser and compression.
   - It speeds every line up by the same factor (×1.30, pitch preserved) to reach the reference pace.
   - It force-aligns every word with faster-whisper.
4. `scripts/02_timeline.py` writes the cut list (every cut lands on a word) and the event times for the sound effects.
5. `render/` contains the three.js scene (`world.js`, `chars.js`, `faces.js`, `shots.js`). `scripts/render_all.sh` renders it deterministically with headless Chromium.
6. `scripts/03_audio.py` synthesises the sound design in numpy: boings, crowd, burp, impacts, whooshes, crickets and a muffled party beat.
   - It ducks the effects under the voice.
   - It normalises the mix to −14 LUFS with true peak below −1 dBTP.
7. `scripts/04_captions.py` writes the word-by-word ASS captions, the SRT and the word timing CSV. `scripts/05_assemble.sh` burns the captions, muxes the audio and exports the files.

Rebuild (after the voice takes exist):
```
python3 scripts/01b_voice_build.py && python3 scripts/02_timeline.py
scripts/render_all.sh && python3 scripts/03_audio.py && python3 scripts/04_captions.py && scripts/05_assemble.sh
```
