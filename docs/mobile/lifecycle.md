# Lifecycle, audio and Android Back — #49

The native app uses the official `@capacitor/app@8.1.2` plugin via Capacitor's injected JS bridge, with browser `visibilitychange`/page events as a fallback. A dedicated small controller de-duplicates these signals.

## Foreground/background

- Background/pagehide freezes the simulation loop and pauses elapsed score time.
- The audio engine closes its active AudioContext to stop sounds still scheduled on a now-background app.
- Foreground/pageshow resets the animation wall clock and re-synchronizes viewport dimensions. The next user interaction initializes audio again, avoiding autoplay restrictions.
- The 3D canvas continues to handle WebGL context loss and restoration independently (#47).

## Android Back priority

1. Close exit confirmation if already shown.
2. Close the score/debrief, defense, or planet selector modal.
3. Close the utility menu.
4. Cancel satellite placement.
5. Exit country/continent mode to the main Earth view.
6. Only when none of the above applies, show an **in-game exit confirmation** with Continue/Exit buttons. The exit button calls `App.exitApp()` only if the native plugin exists.

For a website without Capacitor the browser fallback stays active and there is no automatic app termination.

## Required device QA

- [ ] Return from background/lock screen **five times** without simulation jumping forward.
- [ ] Confirm no two overlapping sounds or audio blast lingering after background.
- [ ] Android Back closes each modal/menu first, then shows confirmation, then exits on explicit confirmation.
- [ ] iOS app switcher / interruptions do not cause a black screen; no force-exit gesture is added for iOS.
- [ ] Score timer does not advance while paused and reopens at normal speed.
- [ ] Release app logs do not show uncaught errors from the native App bridge.

These hardware checks are pending. Passing Node and native compile CI alone does not close issue #49.

Reference: https://capacitorjs.com/docs/apis/app
