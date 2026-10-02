# Hush Harbor

A small tower defense game built as a mobile-friendly web app with a light minimalist art direction.

## How to run

Open `index.html` directly in a browser, or serve the folder locally:

```bash
cd tower-defense-minimalist
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Controls

- Tap or click the board to place a tower on an empty tile.
- Choose tower type using the two build buttons.
- Tap a placed tower to select it, then use Upgrade.
- Press Start Wave to send enemies down the path.

## Gameplay loop

- Defend the harbor from incoming enemies.
- Earn gold by defeating enemies and spending it on new towers and upgrades.
- Lose once your lives reach zero.

## Files

- `index.html` — app structure and HUD
- `style.css` — minimalist light art presentation and mobile layout
- `script.js` — game logic, enemy AI, tower mechanics, and rendering

## Status

This is a lightweight static game designed to be simple, fast, and easy to extend.
