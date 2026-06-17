# Logo Update Guide

When the logo changes, replace `app-icon-source.png` and regenerate all derived files using the commands below.

## Source File

```
cookbook-ui/src/assets/images/app-icon-source.png
```

Replace this file first. Must be square, minimum 512x512, PNG. Current: 2000x2000.

---

## Derived Files (all auto-generated — do not edit manually)

| File | Size | Used for |
|------|------|---------|
| `public/favicon.ico` | 16/32/48px multi | Browser tab (IE, legacy) |
| `public/favicon-16x16.png` | 16x16 | Browser tab small |
| `public/favicon.png` | 32x32 | Browser tab standard |
| `public/favicon-96x96.png` | 96x96 | HiDPI browser tabs, Android |
| `src/assets/images/apple-touch-icon.png` | 180x180 | iPhone Retina home screen |
| `src/assets/images/apple-touch-icon-167.png` | 167x167 | iPad Pro home screen |
| `src/assets/images/apple-touch-icon-152.png` | 152x152 | iPad Retina home screen |
| `src/assets/images/apple-touch-icon-120.png` | 120x120 | Older iPhone home screen |
| `src/assets/images/icon-192.png` | 192x192 | PWA manifest / Android |
| `src/assets/images/icon-512.png` | 512x512 | PWA manifest splash |

---

## Regenerate All — Run This

```bash
cd /path/to/cookbook-ui
SRC="src/assets/images/app-icon-source.png"
ASSETS="src/assets/images"
PUB="public"
BG="#f5f0e8"

# Touch icons: solid background required — Apple adds black fill on transparent icons
magick -background "$BG" "$SRC" -resize 180x180 -flatten "$ASSETS/apple-touch-icon.png"
magick -background "$BG" "$SRC" -resize 167x167 -flatten "$ASSETS/apple-touch-icon-167.png"
magick -background "$BG" "$SRC" -resize 152x152 -flatten "$ASSETS/apple-touch-icon-152.png"
magick -background "$BG" "$SRC" -resize 120x120 -flatten "$ASSETS/apple-touch-icon-120.png"

# PWA manifest icons
magick -background "$BG" "$SRC" -resize 192x192 -flatten "$ASSETS/icon-192.png"
magick -background "$BG" "$SRC" -resize 512x512 -flatten "$ASSETS/icon-512.png"

# Browser favicons (transparent OK — browsers handle it)
magick "$SRC" -filter Lanczos -resize 16x16 -unsharp 0x1 "$PUB/favicon-16x16.png"
magick "$SRC" -filter Lanczos -resize 32x32 -unsharp 0x1 "$PUB/favicon.png"
magick "$SRC" -filter Lanczos -resize 96x96 -unsharp 0x1 "$PUB/favicon-96x96.png"

# Multi-size ICO (48 first = highest priority)
magick \
  <(magick "$SRC" -resize 48x48 png:-) \
  <(magick "$SRC" -resize 32x32 png:-) \
  <(magick "$SRC" -resize 16x16 png:-) \
  "$PUB/favicon.ico"
```

> Requires ImageMagick 7 (`magick` command). Install: `brew install imagemagick`

---

## After Regenerating — Bump the Cache Version

Open `cookbook-ui/src/index.html` and increment the version number on every icon link:

```html
<!-- Change ?v=5 to ?v=6 (or whatever the next number is) on ALL of these lines -->
<link rel="icon" href="/favicon.ico?v=5">
<link rel="icon" href="/favicon-16x16.png?v=5">
<link rel="icon" href="/favicon.png?v=5">
<link rel="icon" href="/favicon-96x96.png?v=5">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png?v=5">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon-167.png?v=5">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon-152.png?v=5">
<link rel="apple-touch-icon" href="/assets/images/apple-touch-icon-120.png?v=5">
```

Also open `cookbook-ui/public/manifest.json` and bump the `?v=` on all four icon `src` paths.

---

## After Deploying — Force Safari to Reload on iPhone

Safari caches home screen icons aggressively. To see the new icon:

1. Long press the app on home screen
2. Remove from Home Screen
3. Reopen in Safari - Share - Add to Home Screen

For the browser tab: Settings - Safari - Clear History and Website Data, then reload.

---

## Notes

- Touch icons use `#f5f0e8` background (the app's warm cream color). Change `BG` if the app theme color changes.
- The logo is complex (book + pan + dots). At 16px it will always be small but recognizable. Do not add extra detail to the source — it will not be visible.
- No SVG mask-icon currently configured (needed only for Safari pinned tabs on macOS desktop — not iOS).
- Current version: `v=7`
