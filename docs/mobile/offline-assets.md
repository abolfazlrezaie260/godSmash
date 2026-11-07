# Offline asset packaging and integrity — #48

GodSmash's native `dist/` is built with locally bundled high-resolution assets. `npm run build` copies all `assets/` files, vendors the executable runtime, and emits `asset-manifest.json`.

The manifest lists each asset's relative path, byte length and SHA-256 checksum, sorted deterministically; no absolute paths or timestamps are included. Both `npm run build` and `npm run build:verify` fail if an asset is missing or changed after manifest generation. The verifier **requires**:

- Earth daytime 4096px JPEG, clouds, night lights, normal and specular textures
- Moon color 4096px JPEG and height preview
- Local `countries-110m.json` polygon data for continent map
- Local Three.js, compiled Tailwind CSS, and font files referenced from bundled font CSS

Images from NASA GIBS remain **optional** for the continent atlas. When offline (`navigator.onLine === false`) the map does not request optional tiles and uses local Earth photography. A failed tile is removed from the cache and does not hide the local fallback. In the Capacitor WebView, the Moon loader only considers packaged local sources and does not stall on network mirrors after a missing asset.

## Verify on the native device

1. From a clean checkout run `npm ci && npm run build && npm run build:verify`; verify no asset integrity errors.
2. Compile and install Android debug and iOS simulator/physical app from the same commit after `cap sync`.
3. Enable airplane mode **before a cold launch**, then open Earth, Moon, Mars and Venus (twice), and the continent/country map. All mandatory visuals should load without CORS/network errors.
4. Switch between online and offline while inspecting the map; optional NASA tiles may disappear but borders and countries must stay interactive.
5. Record cold-start time, installed storage, and local texture load failures for Android and iOS in `docs/mobile/measurements.csv`. Bundle sizes are platform-specific; do not conflate the uncompressed `dist/` size with APK/AAB/IPA download sizes.

Hardware smoke results are **not yet measured**. Do not close #48 until the offline installation flow has passed on Android and iPhone.
