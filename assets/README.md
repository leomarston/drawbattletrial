# DrawBattle — Asset Kit

Original art for a real-time draw-and-guess party game. Same fun, casual,
chunky-and-colorful energy the genre is known for — built as its own brand
(palette, logo, component language) so it's distinct from any competitor and
yours to ship.

## Contents
```
brand/
  style-guide.md   color tokens, type, shape language (start here)
  logo.svg         DrawBattle wordmark + crossed pencil/brush badge
ui/
  buttons.svg      sticker-button system: states, color variants, pills, icon buttons
  toolbar.svg      drawing toolbar: brush, eraser, fill, line, undo, redo, clear, eyedropper
  color-picker.svg 24-color swatch grid + current-color + brush-size selector
  canvas-frame.svg the drawing board with "your turn" ribbon and corner accents
hud/
  timer.svg        circular round countdown
  word-banner.svg  category chip + letter-blank word reveal
  scoreboard.svg   player list w/ avatars, scores, leader crown, drawing/guessed states
  guess-box.svg    chat/guess feed (correct-guess highlight) + input + send
  results.svg      end-of-round podium, revealed word, points, next-round CTA
preview.html       renders every asset + a full composed gameplay screen
```

## View
Open `assets/preview.html` in any browser. Everything is SVG, so it stays
crisp at any zoom and the fonts (Fredoka + Nunito, both open-source) load from
Google Fonts.

## Re-skin everything at once
All colors come from the tokens in `brand/style-guide.md`. Find-and-replace a
token hex across the `assets/` folder (e.g. swap `--coral` `#FB5E7E`) and the
whole kit re-themes consistently.

## Export to PNG
SVGs export to PNG at any resolution. Pick one:

**Inkscape (CLI, batch):**
```bash
for f in assets/**/*.svg; do
  inkscape "$f" --export-type=png --export-dpi=192 --export-filename="${f%.svg}@2x.png"
done
```

**rsvg-convert:**
```bash
rsvg-convert -z 2 assets/ui/toolbar.svg -o toolbar@2x.png
```

**Node (sharp):**
```bash
npx sharp-cli -i "assets/**/*.svg" -o ./png --density 192
```

**No install:** open `preview.html`, right-click any asset → "Save image as…",
or use the browser dev-tools to screenshot a node.

## Using in the game
Drop the SVGs straight into the web client as `<img>` or inline SVG. Because
each interactive element (buttons, swatches, tools) is a self-contained group
with the outline + hard-shadow built in, you can wire hover/press by nudging
the face layer up/down (see the states in `ui/buttons.svg`).
