#!/bin/sh
# builds the single-file solo version (for sharing or the artifact)
cd "$(dirname "$0")"
mkdir -p dist
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="author" content="Designed and built by Claude (Anthropic) with Dave">'
  echo '<title>The Long Campaign</title>'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Rye&display=swap">'
  echo '<style>'; cat public/style.css; echo '</style></head><body>'
  sed -n '/<div id="app">/,/^<\/div>$/p' public/play.html
  echo '<script>'; cat public/engine.js public/client.js public/solo.js; echo 'TLC_solo();</script></body></html>'
} > dist/the-long-campaign-solo.html
wc -c dist/the-long-campaign-solo.html
