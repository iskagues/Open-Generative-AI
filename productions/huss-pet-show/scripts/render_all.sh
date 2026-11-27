#!/bin/bash
# Render every frame in 8 chunks (sequential: swiftshader is CPU-bound), then join.
cd "$(dirname "$0")/.."
F=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['frames'])")
mkdir -p build/segs; : > build/segs/list.txt
for i in $(seq 0 7); do
  s=$(( F * i / 8 )); e=$(( F * (i + 1) / 8 ))
  n=$(ffprobe -v error -count_packets -show_entries stream=nb_read_packets -of csv=p=0 build/segs/seg_$i.mp4 2>/dev/null | head -1)
  if [ "$n" = "$(( e - s ))" ]; then echo "file 'seg_$i.mp4'" >> build/segs/list.txt; continue; fi   # resume: keep finished segments
  (cd render && node driver.js render $s $e ../build/segs/seg_$i.mp4) > build/segs/log_$i.txt 2>&1 || { echo "FAIL seg $i"; exit 1; }
  echo "file 'seg_$i.mp4'" >> build/segs/list.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i build/segs/list.txt -c copy build/picture.mp4 && echo DONE
