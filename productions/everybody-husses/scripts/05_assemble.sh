#!/bin/bash
# Burn captions, mux audio, export deliverables.
set -e
cd "$(dirname "$0")/.."
mkdir -p output; O=output/everybody_husses_except_me.mp4; cp build/music_bed.wav output/music_bed.wav 2>/dev/null || true
ffmpeg -y -loglevel error -i build/picture.mp4 -i build/mix.wav \
  -vf "ass=build/captions.ass:fontsdir=assets/fonts" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -shortest $O
cp build/mix.wav output/final_mix.wav; cp build/voice.wav output/voiceover.wav; cp build/sfx.wav output/sound_effects.wav
cp build/captions.srt output/captions.srt; cp build/captions.ass output/captions_word_by_word.ass; cp build/word_timing.csv output/word_timing.csv
cp build/timeline.json output/shot_timeline.json
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration,size -of compact $O
