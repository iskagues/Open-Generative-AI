import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
times = sys.argv[2:]; out = sys.argv[1]
ims = [Image.open(f'build/preview/t_{float(t):.2f}.jpg') for t in times]
w, h = ims[0].size; cols = min(6, len(ims)); rows = (len(ims) + cols - 1) // cols
sc = 0.5; tw, th = int(w * sc), int(h * sc)
s = Image.new('RGB', (tw * cols, th * rows))
d = ImageDraw.Draw(s); f = ImageFont.truetype('assets/fonts/Anton-Regular.ttf', 28)
for i, (im, t) in enumerate(zip(ims, times)):
    x, y = (i % cols) * tw, (i // cols) * th
    s.paste(im.resize((tw, th)), (x, y)); d.text((x + 8, y + 4), t, fill='yellow', font=f, stroke_width=2, stroke_fill='black')
s.save(out, quality=88)
