# Midnight Manor

A self-contained browser horror escape game built with HTML, CSS, and vanilla JavaScript.

## Run

- **Quick start:** open `/home/runner/work/midnight-manor/midnight-manor/index.html` in a browser.
- **Optional local server:** from the repo root, run `python -m http.server 8000` and open `http://localhost:8000`.

## Objective

Escape Midnight Manor by:
1. Collecting **3 clues**.
2. Finding the **Manor Key**.
3. Surviving the roaming **Warden** and preserving sanity.
4. Unlocking the **Front Gate** before you are caught or lose sanity.

## Controls

- **Move:** Arrow keys / WASD (or on-screen directional buttons)
- **Interact:** `E` (or Interact button)
- **Flashlight:** `F` (or Toggle Light button)
- **Restart:** available on the end screen

## Mechanics

- Limited flashlight battery with a collectible battery refill.
- Inventory for keys and clues.
- Locked doors with progression requirements.
- Enemy proximity drains sanity and triggers visual/audio horror effects.
- Win/lose states with restart flow.

## Implementation notes

- No external assets or paid services are required.
- Atmosphere is generated with CSS gradients, canvas lighting/fog, and Web Audio API tones.
- Layout is responsive for desktop and mobile, with keyboard and touch controls.
