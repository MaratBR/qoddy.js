#!/usr/bin/env sh
# Draws the iPhone's images from the Q in static/icon.svg.
#
# The home-screen icon (static/apple-touch-icon.png) is the Q in reverse, cream
# on ink: iOS takes one icon from a web app and shows it in light and dark mode
# alike, and a dark icon sits well on both, where the light one glares.
#
# The launch screens (static/splash/):
# the logo centered on the default theme's paper (Morning in src/lib/themes.ts),
# light and dark, so launch hands over to the app without a change of color.
# Android builds its own from the manifest's icon and background_color.
#
# iOS shows a startup image only when its size matches the device exactly, so
# each phone size needs its own pair. Prints the <link> tags for src/app.html.
# Usage: scripts/ios-images.sh   (needs ImageMagick with librsvg)
set -eu
cd "$(dirname "$0")/.."
mkdir -p static/splash
rm -f static/splash/*.png

# CSS width, height and pixel ratio of each portrait iPhone screen.
DEVICES='
440 956 3
420 912 3
402 874 3
430 932 3
393 852 3
428 926 3
390 844 3
375 812 3
414 896 3
414 896 2
414 736 3
375 667 2
320 568 2
'

logo() { # ink tail [viewBox]
	cat <<-SVG
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="${3:-65 55 320 395}">
		  <g transform="translate(-5 -17)">
		    <circle cx="228" cy="232" r="122" fill="none" stroke="$1" stroke-width="52"/>
		    <path fill="$2" d="M380 334C382 398 350 438 296 458C328 432 342 408 340 384A50 50 0 1 1 380 334Z"/>
		  </g>
		</svg>
	SVG
}

draw() { # file width height paper ink tail
	size=$(($2 * 28 / 100))
	logo "$5" "$6" | magick -background none -density 600 svg:- -resize "${size}x" \
		-gravity center -background "$4" -extent "$2x$3" -strip PNG8:"$1"
}

logo '#f5efe3' '#c4553f' '0 0 512 512' | magick -background '#221d18' -density 300 svg:- \
	-flatten -alpha off -resize 180x180 -depth 8 -strip static/apple-touch-icon.png

echo "$DEVICES" | while read -r w h r; do
	[ -n "$w" ] || continue
	pw=$((w * r))
	ph=$((h * r))
	media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: $r)"
	for mode in light dark; do
		file="static/splash/${pw}x${ph}-$mode.png"
		if [ $mode = light ]; then
			draw "$file" $pw $ph '#e8ece6' '#221d18' '#8a2c1d'
		else
			draw "$file" $pw $ph '#151a17' '#f5efe3' '#c4553f'
		fi
		printf '\t\t<link rel="apple-touch-startup-image" href="%%sveltekit.assets%%/splash/%s" media="%s and (prefers-color-scheme: %s)" />\n' \
			"${pw}x${ph}-$mode.png" "$media" "$mode"
	done
done
