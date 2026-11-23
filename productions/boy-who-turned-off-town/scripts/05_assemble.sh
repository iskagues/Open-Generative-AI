#!/bin/bash
# Step 5 - burn captions, mux the mix, export the deliverable (H.264 high / AAC 48 kHz stereo, faststart)
set -e
cd "$(dirname "$0")/.."
mkdir -p output
ffmpeg -y -loglevel error -i build/picture.mp4 -i build/mix.wav \
  -vf "ass=build/captions.ass:fontsdir=assets/fonts,format=yuv420p" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -shortest \
  output/the_boy_who_turned_off_the_town.mp4
cp build/mix.wav output/final_mix.wav
cp build/voice.wav output/voiceover.wav
ffmpeg -y -loglevel error -i build/music.wav -c:a pcm_s16le output/music_score.wav
cp build/captions.srt output/captions.srt
cp build/captions.ass output/captions_animated.ass
cp build/word_timing.csv output/word_timing.csv
cp build/timeline.json output/shot_timeline.json
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact output/the_boy_who_turned_off_the_town.mp4
