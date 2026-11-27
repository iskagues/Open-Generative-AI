"""The script: one source of truth for voice, captions and the shot plan.

id, speaker, spoken text, caption text (None = same), exaggeration, cfg, pause-after (s)
speaker: kid = Leo (narrator), h6 = six rhythmic "Huss!" built from single narrator takes
"""
H6 = "HUSS! HUSS! HUSS! HUSS! HUSS! HUSS!"
LINES = [
 ("p01", "kid", "In this town, everybody has a pet.", None, 0.80, 0.40, 0.05),
 ("p02", "h6", "Huss, huss, huss, huss, huss, huss.", H6, 1.20, 0.40, 0.15),
 ("p03", "kid", "Grandma's cat can do a backflip.", None, 0.85, 0.40, 0.08),
 ("p04", "kid", "The mailman's dog can jump through a hoop.", None, 0.85, 0.40, 0.25),
 ("p05", "kid", "Except me. Mom said pets are too much work.", None, 0.65, 0.35, 0.25),
 ("p06", "kid", "So I got a rock. His name is Gary.", None, 0.75, 0.35, 0.25),
 ("p07", "kid", "Gary doesn't bark. Gary doesn't eat. Gary doesn't do anything.", None, 0.70, 0.35, 0.25),
 ("p08", "kid", "Then came the Pet Show. First prize: the golden bone.", None, 0.90, 0.45, 0.15),
 ("p09", "kid", "The cat did a triple backflip. The dog jumped through three hoops.", None, 0.95, 0.45, 0.10),
 ("p10", "kid", "Then it was Gary's turn. Gary just sat there. For one whole minute.", None, 0.70, 0.35, 0.20),
 ("p11", "kid", "Everybody laughed. Even the dog laughed.", None, 0.85, 0.40, 0.25),
 ("p12", "kid", "So I trained Gary. Every single night.", None, 0.80, 0.40, 0.10),
 ("p13", "kid", "Sit, Gary. He sat. Stay, Gary. He stayed. Roll over, Gary. We're still working on that.", None, 0.75, 0.35, 0.20),
 ("p14", "kid", "At the final, the judge said: show me your best trick.", None, 0.80, 0.40, 0.10),
 ("p15", "kid", "I took the biggest breath of my life.", None, 0.85, 0.40, 0.15),
 ("p16", "kid", "Huss!", "HUSS!", 1.30, 0.40, 0.20),
 ("p17", "kid", "Every pet in the stadium flew into the mud. Gary didn't move one inch.", None, 1.00, 0.45, 0.20),
 ("p18", "kid", "Best behaved pet in town. Golden bone.", None, 0.90, 0.40, 0.25),
 ("p19", "kid", "Now everybody in this town has a rock.", None, 0.80, 0.40, 0.05),
 ("p20", "h6", "Huss, huss, huss, huss, huss, huss.", H6, 1.20, 0.40, 0.10),
]
