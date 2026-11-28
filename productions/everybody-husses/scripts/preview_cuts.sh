#!/bin/bash
# render the middle frame of every cut (or of the cuts named) and tile them into build/preview/sheet_N.jpg
cd "$(dirname "$0")/.."
TIMES=$(python3 -c "
import json,sys;tl=json.load(open('build/timeline.json'));sel=set(sys.argv[1:])
print(' '.join(f\"{(c['start']+c['end'])/2:.2f}\" for c in tl['cuts'] if not sel or c['name'] in sel))" "$@")
rm -f build/preview/t_*.jpg 2>/dev/null
(cd render && PREVIEW_SCALE=${PREVIEW_SCALE:-0.4} node driver.js preview $TIMES > /dev/null) || exit 1
python3 - <<'P'
import glob,subprocess,os
fs=sorted(glob.glob('build/preview/t_*.jpg'),key=lambda f:float(f.split('t_')[1][:-4]))
for k in range(0,len(fs),16):
    part=fs[k:k+16]; args=[]
    for f in part: args+=['-i',f]
    n=len(part); cols=min(8,n); rows=(n+cols-1)//cols
    lay='|'.join(f'{(i%cols)}*w0_{(i//cols)}*h0'.replace('*w0','*432').replace('*h0','*768').replace('0*432','0').replace('_0*768','_0') for i in range(n))
    lay='|'.join(f'{(i%cols)*432}_{(i//cols)*768}' for i in range(n))
    subprocess.run(['ffmpeg','-v','error','-y',*args,'-filter_complex',''.join(f'[{i}:v]scale=432:768[v{i}];' for i in range(n))+''.join(f'[v{i}]' for i in range(n))+f'xstack=inputs={n}:layout={lay}:fill=black' if n>1 else 'null','-frames:v','1',f'build/preview/sheet_{k//16}.jpg'],check=True)
    print(f'build/preview/sheet_{k//16}.jpg', [os.path.basename(f) for f in part][0], '...')
P
