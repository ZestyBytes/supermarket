#!/usr/bin/env sh
# Inline the site into a single fragment for publishing as a Claude Artifact.
# The Artifact host supplies <!doctype>, <head> and <body>, so the output
# carries only the title, font link, styles, markup and scripts.
set -e
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out="$root/dist/artifact.html"
mkdir -p "$root/dist"

{
  echo '<title>Ridgeway Market</title>'
  grep 'fonts.googleapis.com/css2' "$root/index.html"
  echo '<style>'
  cat "$root/assets/styles.css"
  echo '</style>'
  awk '/<header class="masthead">/{on=1} /<script src=/{on=0} on' "$root/index.html"
  echo '<script>'
  cat "$root/assets/products.js"
  echo '</script>'
  echo '<script>'
  cat "$root/assets/app.js"
  echo '</script>'
} > "$out"

echo "wrote $out"
