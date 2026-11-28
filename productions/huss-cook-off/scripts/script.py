"""The script: one source of truth for voice, captions and the shot plan.

id, speaker, spoken text, caption text (None = same), exaggeration, cfg, pause-after (s)
speaker: kid = Leo (narrator), h6 = six rhythmic "Huss!" built from single narrator takes
"""
H6 = "HUSS! HUSS! HUSS! HUSS! HUSS! HUSS!"
LINES = [
 ("p01", "kid", "In this town, everybody can cook.", None, 0.80, 0.40, 0.05),
 ("p02", "h6", "Huss, huss, huss, huss, huss, huss.", H6, 1.20, 0.40, 0.15),
 ("p03", "kid", "Grandma bakes pies so good, the birds line up outside.", None, 0.85, 0.40, 0.08),
 ("p04", "kid", "The mailman flips pancakes over his own house.", None, 0.90, 0.40, 0.25),
 ("p05", "kid", "Except me. I burned water. Twice.", None, 0.70, 0.35, 0.20),
 ("p06", "kid", "The smoke alarm knows my name.", None, 0.75, 0.35, 0.25),
 ("p07", "kid", "Then came the town cook-off. First prize: the golden spoon.", None, 0.90, 0.45, 0.15),
 ("p08", "kid", "Everybody looked at me and said: Leo, please. Remember the water.", None, 0.80, 0.40, 0.25),
 ("p09", "kid", "So I trained. Toast. Burned. Cereal. Burned. Ice cream. Somehow, burned.", None, 0.85, 0.40, 0.20),
 ("p10", "kid", "Then Grandma told me her secret.", None, 0.70, 0.35, 0.10),
 ("p11", "kid", "You don't cook with your hands, Leo. You cook with your huss.", None, 0.75, 0.40, 0.25),
 ("p12", "kid", "Cook-off day. I had one raw pizza. And no oven.", None, 0.80, 0.40, 0.15),
 ("p13", "kid", "The judge sighed. Everybody laughed.", None, 0.80, 0.40, 0.15),
 ("p14", "kid", "I took the biggest breath of my life.", None, 0.85, 0.40, 0.15),
 ("p15", "kid", "Huss!", "HUSS!", 1.30, 0.40, 0.20),
 ("p16", "kid", "The pizza spun so fast, it cooked itself. Perfectly golden.", None, 1.00, 0.45, 0.15),
 ("p17", "kid", "The judge took one bite, and cried.", None, 0.85, 0.40, 0.15),
 ("p18", "kid", "Golden spoon.", None, 0.95, 0.40, 0.25),
 ("p19", "kid", "Now everybody in this town cooks with a huss.", None, 0.80, 0.40, 0.05),
 ("p20", "h6", "Huss, huss, huss, huss, huss, huss.", H6, 1.20, 0.40, 0.10),
]
