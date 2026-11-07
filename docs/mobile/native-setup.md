# Build and run GodSmash on Android / iOS

Status: native wrappers use Capacitor 8.6.0; **device smoke tests and release signing are not verified**.

## Prerequisites

- Node.js 22+ and npm
- Android Studio (2025.2.1+ recommended by Capacitor 8) and Android SDK (API 24+ supported)
- macOS with Xcode 26.0+ for iOS and an iPhone for a real-device test
- App identifiers and app-store signing credentials must be owned and configured before release

Application ID: `io.github.abolfazlrezaie260.godsmash`. Confirm this identifier before publishing: changing the bundle ID later creates a different app in the stores.

## Initial setup

```sh
npm ci
npm test
npm run build
npx cap sync
```

The root GitHub Pages entrypoint remains untouched; native apps use `dist/`.
The web runtime includes local Three.js, compiled Tailwind CSS, and local fonts.

## Android debug run

```sh
npm run mobile:android
# Android Studio: select connected device and Run
```

If platform projects have not yet been checked in, initialize with `npx cap add android` once. Never commit `local.properties` or signing keystores.

## iOS debug run (macOS required)

```sh
npm run mobile:ios
# Xcode: choose Team/Signing and a connected iPhone or simulator, then Run
```

If platform projects have not yet been checked in, initialize with `npx cap add ios` once. Capacitor 8 uses Swift Package Manager by default; Xcode signing still requires the developer's Apple account.

## Smoke checklist (not yet verified on devices)

- [ ] No white screen; local Earth/other planets load in offline / airplane mode
- [ ] Browser/game UI fits screen, including notch and navigation bar
- [ ] Weapon dock, fire button, mode, zoom, planet picker and defense modal are touch-operable
- [ ] Country-to-country map works without optional NASA tiles
- [ ] Exit / background / resume does not speed up simulation
- [ ] Local leaderboard persists after app relaunch
- [ ] WebGL context survives ordinary task switching and reset

Detailed platform behavior is handled by #45 through #51. Release signing and store metadata belong to #54/#55. No developer signing keys are expected in this repository.

Official guidance: https://capacitorjs.com/docs/getting-started
