#!/usr/bin/env bash
# Regenerate every PNG icon and iOS splash screen from public/icon.svg.
# Needs ImageMagick 7 (`magick`) and the Inter font. Run from anywhere: client/scripts/make-icons.sh
set -euo pipefail
cd "$(dirname "$0")/../public"

SRC=icon.svg
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Full-bleed square (no rounded corners) for maskable and Apple icons: the OS applies its own mask.
# Maskable icons also shrink the mark so it stays inside Android's circle crop.
sed 's/rx="112"/rx="0"/' "$SRC" > "$TMP/square.svg"
sed 's|<g>|<g transform="translate(256 256) scale(0.82) translate(-256 -256)">|' "$TMP/square.svg" > "$TMP/maskable.svg"

render() { # svg size out
  magick -background none -density 384 "$1" -resize "$2x$2" "$3"
}

for s in 96 192 512; do render "$SRC" "$s" "icon-$s.png"; done
for s in 192 512; do render "$TMP/maskable.svg" "$s" "$TMP/m.png"; magick "$TMP/m.png" -background '#007aff' -flatten "maskable-$s.png"; done
render "$TMP/square.svg" 180 "$TMP/a.png"; magick "$TMP/a.png" -background '#007aff' -flatten apple-touch-icon.png

# iOS splash: 108pt icon, 24pt gap, app name; centred on the light background
# (--bg, same as the manifest background_color).
FONT=$(fc-match -f '%{file}' 'Inter:style=SemiBold')
for f in splash/splash-*.png; do
  wh=${f#splash/splash-}; wh=${wh%.png}; w=${wh%x*}; h=${wh#*x}
  dpr=3; [ "$w" -lt 1000 ] && dpr=2
  icon=$((108 * dpr)); gap=$((24 * dpr)); pt=$((21 * dpr))
  render "$SRC" "$icon" "$TMP/i.png"
  magick -background none -fill '#000000' -font "$FONT" -pointsize "$pt" label:'VAE Manager' "$TMP/t.png"
  magick "$TMP/i.png" \( -size "1x$gap" xc:none \) "$TMP/t.png" -background none -gravity center -append "$TMP/g.png"
  magick -size "${w}x${h}" xc:'#f2f2f7' "$TMP/g.png" -gravity center -composite -strip "$f"
done
echo "Icons and splash screens written to client/public."
echo "Bump ?v=N on the icon URLs in index.html and public/manifest.webmanifest so installed apps pick them up."
