#!/bin/bash
# Renders all frames in 8 chunks, 4 at a time, then concatenates to build/picture.mp4
cd "$(dirname "$0")/.."
N=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['frames'])")
CH=8; STEP=$(( (N + CH - 1) / CH ))
mkdir -p build/segs
for i in $(seq 0 $((CH-1))); do s=$((i*STEP)); e=$(( s+STEP < N ? s+STEP : N )); echo "$i $s $e"; done | \
  xargs -P 1 -L 1 bash -c 'node render/driver.js render $1 $2 build/segs/seg_$0.mp4 > build/segs/log_$0.txt 2>&1'
ls build/segs/seg_*.mp4 | sort -V | sed "s/^/file '..\//; s/$/'/" | sed "s#'../build/segs/#'#" > build/segs/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/segs/list.txt -c copy build/picture.mp4
echo DONE
