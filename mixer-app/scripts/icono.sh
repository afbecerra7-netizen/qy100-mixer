#!/bin/sh
# Renders assets/icono/qy100-mixer.svg into the 512 px PNG (the Dock, from the repository) and
# the .icns (the packaged app). Needs rsvg-convert (brew install librsvg) and macOS's iconutil.
set -e
cd "$(dirname "$0")/../assets/icono"
SET=$(mktemp -d)/qy100-mixer.iconset
mkdir -p "$SET"
for n in 16 32 128 256 512; do
  rsvg-convert -w $n -h $n qy100-mixer.svg -o "$SET/icon_${n}x${n}.png"
  rsvg-convert -w $((n * 2)) -h $((n * 2)) qy100-mixer.svg -o "$SET/icon_${n}x${n}@2x.png"
done
cp "$SET/icon_512x512.png" qy100-mixer-512.png
iconutil -c icns "$SET" -o qy100-mixer.icns
echo "icono: qy100-mixer-512.png y qy100-mixer.icns"
