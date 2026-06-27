# DrawBattle — Art Direction & Style Guide

An **original** visual identity for a real-time draw-and-guess party game.
Same genre energy as the category leaders (instantly fun, chunky, colorful,
zero learning curve) — but its own palette, logo, and component language so
it's legally yours and distinct on a shelf next to competitors.

---

## 1. Personality

Loud, friendly, fast. Big tap targets, thick "sticker" outlines, hard drop
shadows for a tactile 3D feel, candy-bright accents on a deep night-indigo
stage so the canvas and colors pop. Nothing thin, nothing subtle.

---

## 2. Color tokens

### Stage / surfaces
| Token            | Hex       | Use |
|------------------|-----------|-----|
| `--night`        | `#181436` | App background (deepest) |
| `--night-2`      | `#241C53` | Raised background / lobby |
| `--panel`        | `#2E2566` | Side panels, HUD bars |
| `--panel-2`      | `#3B2E84` | Panel highlights, inset rows |
| `--card`         | `#FFFFFF` | Canvas, cards, popovers |
| `--cloud`        | `#F4F2FB` | Card insets, disabled fills |

### Brand + accents
| Token            | Hex       | Use |
|------------------|-----------|-----|
| `--teal`         | `#2DD4BF` | Primary brand, "draw" turn |
| `--violet`       | `#8B5CF6` | Secondary brand |
| `--coral`        | `#FB5E7E` | Primary CTA / "battle" accent |
| `--amber`        | `#FFB23E` | Highlights, coins, timer warm |
| `--lime`         | `#A3E635` | Success, correct guess |
| `--sky`          | `#38BDF8` | Info, links |

### Ink / text
| Token            | Hex       | Use |
|------------------|-----------|-----|
| `--ink`          | `#1E1B33` | Outlines, primary text, hard shadow |
| `--slate`        | `#6B6790` | Muted text |
| `--white`        | `#FFFFFF` | Text on dark/accent |

### In-game drawing palette (the swatch picker — 24 colors)
```
Row 1: #FFFFFF #C1C1C1 #EF4444 #F97316 #FACC15 #84CC16 #22C55E #14B8A6
Row 2: #000000 #4B4B4B #7F1D1D #9A3412 #854D0E #3F6212 #166534 #115E59
Row 3: #38BDF8 #2563EB #8B5CF6 #D946EF #FB7185 #F472B6 #A16207 #FBE8C0
```

---

## 3. Shape language
- **Corner radius:** cards `20`, buttons `16`, pills `999`, swatches `8`.
- **Outline:** `--ink` at `3px` (`3.5` on large hero pieces). Every interactive
  object is fully outlined — the "sticker" look.
- **Hard shadow:** a solid `--ink` (or darker shade of the fill) layer offset
  `+0,+6` behind buttons/cards. No soft blur. Press state = shift face down
  `+4` and shrink shadow to `+2`.
- **Highlight:** a 35%-white rounded cap across the top ~40% of buttons.

---

## 4. Type
- **Display / logo / headings:** Fredoka (700/600) — rounded, friendly, free
  (SIL OFL). Fallback: Baloo 2, system rounded.
- **UI / body / chat:** Nunito (700/600/400) — open-source, pairs cleanly.
- Headings use a `--ink` outline + slight letter-spacing for the sticker look.

---

## 5. Files
```
assets/
  brand/   logo, palette swatch sheet, this guide
  ui/      buttons, drawing toolbar, color picker, brush sizes, canvas frame
  hud/     round timer, scoreboard, word banner, guess box, results screen
  preview.html   renders every asset on the real app background
```
Everything is **SVG** — crisp at any size, recolorable via the tokens above,
and exportable to PNG at any resolution (see `assets/README.md`).
