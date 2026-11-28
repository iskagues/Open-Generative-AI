"""The script: one source of truth for voice, captions and the shot plan.

id, speaker, spoken text, caption text (None = same), exaggeration, cfg, pause-after (s)
speaker: kid = Leo (narrator, first person, young-adult storyteller voice), ava = team captain
"""
LINES = [
 ("p01", "kid", "In this town, everybody husses.", None, 0.85, 0.45, 0.12),
 ("p02", "kid", "Grandma opens a jar. Huss!", "Grandma opens a jar. HUSS!", 1.00, 0.45, 0.10),
 ("p03", "kid", "The mailman lifts a box. Huss!", "The mailman lifts a box. HUSS!", 1.00, 0.45, 0.10),
 ("p04", "kid", "Even the cat stretches. Huss!", "Even the cat stretches. HUSS!", 1.00, 0.45, 0.25),
 ("p05", "kid", "Except me.", None, 0.60, 0.35, 0.35),
 ("p06", "kid", "When I try to huss, I just... squeak.", None, 0.75, 0.40, 0.35),
 ("p07", "kid", "Every summer, our town plays tug of war against Mudville.", None, 0.85, 0.50, 0.10),
 ("p08", "kid", "And every summer, we lose. Face first. Into the mud.", None, 0.85, 0.45, 0.30),
 ("p09", "kid", "This year, our captain was one player short.", None, 0.75, 0.45, 0.10),
 ("p10", "ava", "You're in, Leo. Just... don't squeak.", None, 0.85, 0.50, 0.30),
 ("p11", "kid", "So I tried everything.", None, 0.85, 0.45, 0.10),
 ("p12", "kid", "Grandpa's mega spicy chili. Smoke came out of my ears. Squeak.", None, 0.95, 0.50, 0.20),
 ("p13", "kid", "A huss tutorial. Even the laptop hussed louder than me.", None, 0.90, 0.50, 0.35),
 ("p14", "kid", "So every night, while the town slept, I trained. No huss. Just me and a rope.", None, 0.70, 0.45, 0.20),
 ("p15", "kid", "Night one, I pulled Grandma's car.", None, 0.80, 0.45, 0.10),
 ("p16", "kid", "Night seven, the ice cream truck. With the driver still asleep inside.", None, 0.95, 0.50, 0.40),
 ("p17", "kid", "Then came the big pull.", None, 0.80, 0.40, 0.15),
 ("p18", "kid", "Mudville hussed so hard, the trees lost their leaves.", None, 0.95, 0.50, 0.10),
 ("p19", "kid", "Huss! Huss! Huss!", "HUSS! HUSS! HUSS!", 1.20, 0.50, 0.20),
 ("p20", "kid", "Ten seconds left. Our shoes were sliding toward the mud.", None, 0.95, 0.50, 0.15),
 ("p21", "kid", "I grabbed the rope. I opened my mouth...", None, 0.90, 0.45, 0.25),
 ("p22", "kid", "Squeak.", None, 0.55, 0.35, 0.25),
 ("p23", "kid", "Mudville laughed so hard, they almost let go.", None, 0.80, 0.45, 0.25),
 ("p24", "kid", "Five seconds. Seven nights of pulling, all saved up.", None, 0.90, 0.45, 0.15),
 ("p25", "kid", "And then... it came out.", None, 0.90, 0.40, 0.20),
 ("p26", "kid", "Huss!", "HUSS!", 1.30, 0.40, 0.20),
 ("p27", "kid", "The rope snapped tight. All of Mudville flew over our heads, did a full loop, and landed face first in their own mud.", None, 1.00, 0.55, 0.20),
 ("p28", "kid", "We won!", None, 1.15, 0.50, 0.40),
 ("p29", "kid", "Now everybody in this town husses. Even me.", None, 0.80, 0.45, 0.20),
 ("p30", "kid", "Huss! Huss! Huss!", "HUSS! HUSS! HUSS!", 1.25, 0.50, 0.00),
]
