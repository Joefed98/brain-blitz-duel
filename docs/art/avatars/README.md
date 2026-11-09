# Joulz game avatars

32 free avatars, one per game. Each is drawn in a 100x100 box: a thick dark outline (#06080F), a glossy main colour the player picks (any of the 32 player colours), an accent colour, and a faint scene from its game behind it (42% opacity under a 35% dark wash, kept at every size).

Gem colours (earned with mastery stars, never sold) replace the main colour with a gem gradient and add a jewel rim, outer glow, light sweep and sparkles; the scene stays.

- `svg/`: each avatar in its default colours with its scene, and one example per gem.
- `avatars.json`: slugs, names, default colours, gem thresholds and gradient stops.
- `source/`: the Python that draws them (avatars.py, avatars2.py, scenes.py), so the app can rebuild them as code with any colour.
