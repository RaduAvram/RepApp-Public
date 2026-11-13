# TempoTrack: UX polish plus bug, animation and code-quality pass

## Context

Two scopes, both in this plan:

1. **UX polish** (the first request), with your decisions: manual "Start set N" between sets (no rest clock); sound on phase changes during reps, vibration only on the 3-2-1, no vibration during reps; structure and look stay as they are ("polish only").
2. **Bugs, animation quirks and code problems** (the follow-up request), found by reading all of `src/` plus the config.

Nothing was run (plan mode, and `node_modules` is not installed), so items marked *(verify)* are reasoned from the code and need a look in the browser before fixing.

What already works and stays: the timer card (ring, number, phase label, per-phase colour, ripple), the 3-2-1, fullscreen and its back-button handling, auto-hiding controls, the segmented set/rep bar, pinning and history, the PWA setup, and the timer-above / configure-below layout. The phase state machine is simple and wall-clock based. Most animation problems share one cause: per-frame values live in React state, so every animation is tied to React's render rate.

---

## Findings

### A. Bugs

| # | Problem | Where |
|---|---|---|
| A1 | **Wake lock is lost after any pause.** The effect's active branch only adds a `visibilitychange` listener; the lock is requested solely in `startTimer`. Resume never re-requests it, so the screen can sleep mid-session. | `RepTimer.tsx:111-127`, `:247` |
| A2 | **No way out of the finished state.** `onReset` is only reachable through Pause then Stop; the finished view is a static badge. Restarting needs a reload. | `RepTimer.tsx:682-690` |
| A3 | **Confetti re-fires while finished.** The effect depends on tempo/reps/sets, so every Randomize or tempo edit after finishing bursts again, above the modal. | `RepTimer.tsx:228-241` |
| A4 | **Confetti is invisible in fullscreen.** Its canvas is appended to `<body>`, outside the fullscreen element. | `RepTimer.tsx:234` |
| A5 | **Rotate-device overlay is bypassed in fullscreen** for the same reason; in landscape fullscreen the card's `min-h-[450px]` clips the Start/Pause button. | `App.tsx:125`, `RepTimer.tsx:421` |
| A6 | **Pinned timings can be silently deleted.** History is capped by array position (`.slice(0, 50)`); pins are only sorted for display. `handlePinCurrent` bypasses the cap. | `TempoSettings.tsx:87`, `:124` |
| A7 | **Delete button never appears on touch devices** (`opacity-0 group-hover:opacity-100`). | `TempoSettings.tsx:327` |
| A8 | **Unprotected `localStorage.setItem` inside state updaters** (six places). If storage throws, the app blanks; updaters must also be pure. | `TempoSettings.tsx:88, 126, 138, 178, 188` |
| A9 | **Backgrounding the tab corrupts a rep.** rAF stops but the clock runs on, so on return one phase ends instantly with a huge duration. | `RepTimer.tsx:331-363` |
| A10 | **Resume can skip a phase** *(verify, timing-dependent)*. The loop effect starts with the stale `phaseStartTime` in the same commit in which another effect corrects it. | `RepTimer.tsx:139-143`, `:331` |
| A11 | **Zero-length phases flash.** HOLD/PAUSE at 0s (Randomize gives this a third of the time) still show for a frame: colour snap, ripple, label remount. | `RepTimer.tsx:352` |
| A12 | **A phantom LIFT flashes at the end** *(verify)*. `nextPhase` enters `concentric` after the last rep; finish is detected a render later. | `RepTimer.tsx:291-297`, `:222-226` |
| A13 | **Changing reps/sets mid-session** shifts set boundaries; lowering them can finish the session on the spot. | `App.tsx:63-66`, `:185-195` |
| A14 | **App crashes over plain HTTP on the LAN.** `crypto.randomUUID` needs a secure context, and the dev script binds `0.0.0.0` for phone testing. | `App.tsx:20` |
| A15 | **Hidden controls are still tappable on touch** *(verify on a device)*. `touchstart` reveals them before the click is dispatched. | `RepTimer.tsx:149-160`, `:457`, `:726` |
| A16 | **iOS home-screen icon.** `apple-touch-icon` is an SVG, which iOS rejects; the manifest lists one SVG for all sizes. | `index.html:6`, `vite.config.ts:60-78` |
| A17 | History timestamps show time only; dedupe checks only the newest entry, so A, B, A, B accumulates. | `TempoSettings.tsx:68-78`, `:307` |

### B. Animation errors and quirks

| # | Problem | Where |
|---|---|---|
| B1 | **Phase colours snap; "Seamless Transitions" does nothing during reps.** A `linear-gradient` cannot be interpolated, so only opacity transitions. | `RepTimer.tsx:429-438` |
| B2 | **The session-brightness layer is a no-op**: an empty div with `filter: brightness()`. | `RepTimer.tsx:440-446` |
| B3 | **Uneven frame pacing at the default 40 FPS.** 40 (and 25) do not divide 60, so frames land 16.7 / 16.7 / 33.3 ms apart and the ring judders. The helper text's claim about CSS smoothness is not true for the ring. | `RepTimer.tsx:333-345`, `TempoSettings.tsx:488` |
| B4 | **Everything re-renders per frame**, although the number changes 10x/s. | `RepTimer.tsx:349` |
| B5 | **Springs chasing a per-frame target** (label `scale/y`), and progress segments restarting a tween on `width` every frame. | `RepTimer.tsx:641-651`, `:488-493` |
| B6 | **Blurry phase label** *(verify)*: text under `will-change: transform` scaled to 1.5x; the HOLD shake stutters at low FPS limits. | `RepTimer.tsx:642`, `:653-659` |
| B7 | **Stray dot at 12 o'clock** *(verify)*: a 0.07-unit dash remainder with round caps; the ring is also clipped by 1 unit at its extremes. | `RepTimer.tsx:562-577` |
| B8 | **Timing drift**: each phase ends up to a frame late and the overshoot is discarded; `Date.now()` is not monotonic. | `RepTimer.tsx:296`, `:347` |
| B9 | **Late first frame**: `AnimatePresence mode="wait"` holds the incoming view for 150ms, so the first LIFT appears at ~0.2. | `RepTimer.tsx:584` |
| B10 | **Ripple and label replay on resume** (keyed on `phaseStartTime`); the ripple also animates `borderWidth`. | `RepTimer.tsx:543-551`, `:635` |
| B11 | **Border-width layout shifts** (`border` to `border-[3px]`) on the counter chip, Start/Pause and the selected history row. | `RepTimer.tsx:470`, `:724`, `TempoSettings.tsx:288` |
| B12 | **Inconsistent control fade**: fullscreen fades, Pause/Stop/Resume pop. | `RepTimer.tsx:456` vs `:721` |
| B13 | **Wasted blur**: `backdrop-blur-md` under an opaque fill on the circle; the modal backdrop blurs a still-animating timer. | `RepTimer.tsx:533`, `TempoSettings.tsx:213` |
| B14 | Smaller: modal height snaps between views; idle number 60px vs running 96px on phones; `toFixed(1)` rounds up; `font-black` (900) used but Inter loaded to 800; ring pops full on finish. | various |

### C. Code problems
- **`strict` is off** and lint is only `tsc --noEmit`; no ESLint (the missing-deps effect at `RepTimer.tsx:143` passes), `any` for wake lock and battery, no tests.
- **Side effects inside state updaters**: the countdown updater (`RepTimer.tsx:304-324`), plus A8.
- **`RepTimer.tsx` does five jobs** in 750 lines: wake lock, fullscreen, idle detection, timer engine, rendering.
- **Duplication**: tempo shape declared three times; tempo equality written three times; two phase-naming schemes needing a mapping switch; `(isActive || isCountingDown)` about 15 times; `#1d1d1d`/`#38393a` hard-coded about 8 times.
- **Dead code**: `!isPaused` hide-condition inside the paused branch (`RepTimer.tsx:700, 710`); unreachable `fpsLimit > 0` branch; undefined `custom-scrollbar` class; `contentVisibility` on the toggle knob; `key?: React.Key` prop; unread `Rep` durations and session fields; double haptics on FPS change and reset.
- **Template baggage**: package name `react-example`; unused deps (`@google/genai`, `d3`, `recharts`, `date-fns`, `dotenv`, `express`, `motion`, `tsx`, `autoprefixer`, `@types/express`); the Gemini define and `.env.example`; stale "analytics / AI coaching" descriptions.
- **Misc**: iOS detected by user-agent instead of `document.fullscreenEnabled`; render-blocking font `@import`; icon-only buttons lack `aria-label`.

### D. UX friction (from the first pass)
| # | Problem |
|---|---|
| D1 | Sets never stop: 3x12 runs as 36 continuous reps (`App.tsx:65`). |
| D2 | Nothing is remembered: reps, sets, tempo, seamless, FPS reset on reload. |
| D3 | No cue you can follow without looking at the screen. |
| D4 | Pausing mid-set takes two taps once controls have hidden. |
| D5 | Resume drops you mid-phase instantly, with no lead-in. |
| D6 | "Save" is misleading: edits apply live, Save only adds a history entry, backdrop closes without one; two Save buttons. |
| D7 | History numbers are unlabelled; small targets (reps/sets `-`/`+` about 20px) and 9-10px text. |
| D8 | Stop and Clear history act instantly; Stop wipes every completed set. |

---

## Implementation

Ordered so the engine is rebuilt once and the UX features land on top of it.

### Step 1: contained bug fixes
- A1: request the lock inside the effect whenever a session is live and not paused (countdown, running, set break).
- A3/A4: confetti on the `isFinished` transition only, via `confetti.create()` on a canvas inside the card.
- A5: render the rotate overlay inside the card container as well.
- A14: `newId()` helper in `src/lib/utils.ts` with a fallback.
- A16: 192/512 PNG icons and a PNG `apple-touch-icon`.
- B2, B7, B11, B12, B13: fix or delete the brightness layer; hide the stroke at zero progress and use r=197; constant border widths; shared opacity transition; drop the circle's backdrop blur.

### Step 2: timer engine (A9-A12, B3-B6, B8-B10, D1, D5)
New `src/hooks/usePhaseTimer.ts`; per-frame values leave React state.
- State only for what changes per phase: `status` (idle / countdown / running / paused / setBreak / finished), `currentPhase`, a phase counter for keys.
- rAF loop on `performance.now()` writes ring `strokeDashoffset`, label transform and the current progress segment (`scaleX`) through refs; the number's text updates only when the displayed tenth changes.
- Next phase starts at `previousStart + target`; zero-length phases are skipped; finish and **set break** are decided inside the phase advance (`(completed + 1) % targetReps === 0` and not finished → `setBreak`).
- **Resume with lead-in**: resume runs the 3-2-1 and restarts the interrupted rep at LIFT; this removes the pause-sync effect and its race.
- **Auto-pause** on `visibilitychange` to hidden, and when the timings modal opens mid-session.
- Countdown side effects move out of the state updater; ripple/label keyed on the phase counter.
- Frame limiter gets a tolerance; options become 30 / 60 / 120 (all divide common refresh rates); helper text corrected.
- Engine exposes `onPhaseStart(phase)`, `onSetComplete`, `onFinish` callbacks for Step 4.

### Step 3: session flow UI (`RepTimer.tsx`, `App.tsx`) (A2, A13, A15, D1, D4, D8)
- Set break view: "SET 1 COMPLETE", main button "START SET 2" (runs the 3-2-1), small Stop beside it using the existing 1/4 + 3/4 layout.
- Finished view: "NEW SESSION" button calling `onReset`, plus one summary line (sets x reps, time under tension from `session.reps[].totalDuration`).
- Tapping the ring pauses/resumes in one tap; Space does the same on desktop. Hidden buttons stay non-interactive until the reveal has rendered (resolves A15).
- Stop needs a second tap ("END?" for 3s).
- `onRunningChange` prop; `App` disables the reps/sets steppers while a session is in progress.

### Step 4: cues (new `src/lib/audio.ts`) (D3)
- Lazy `AudioContext`, resumed inside the Start tap; `playCue(name)` plays a short enveloped tone. Distinct pitches for LIFT / HOLD / LOWER / PAUSE, two notes for set complete, three for finish, wired to the engine callbacks.
- Countdown: `triggerHaptic` on 3, 2, 1 only. No countdown sound, no vibration during reps.
- Speaker toggle on the timer card mirroring the fullscreen button; default on; persisted.

### Step 5: persistence and timings modal (A6-A8, A17, D2, D6, D7)
- New `src/lib/storage.ts`: guarded `loadSettings`/`saveSettings` (reps, sets, tempo, seamless, FPS, sound) and `loadHistory`/`saveHistory`; history persisted from one `useEffect`; one `sameTempo(a, b)` helper.
- Cap only unpinned entries; dedupe against the whole list; add to history only if the tempo changed since the modal opened.
- "Save" becomes "Done"; backdrop and Escape do the same as Done.
- History rows: delete always visible, larger pin/delete targets, date when not today, a "LIFT · HOLD · LOWER · PAUSE" legend; Clear uses the two-tap confirm.

### Step 6: colour transitions (B1)
One stacked gradient layer per theme, cross-faded by opacity, so the Seamless Transitions duration applies between phases.

### Step 7: targets and readability (D7, B14)
- 44px reps/sets steppers with `Minus`/`Plus` icons; 44px tempo chevrons; `aria-label`s on icon buttons.
- `text-[9px]`/`text-[10px]` raised to 11px minimum; Configure chevron bounces three times, not forever.
- Drop `mode="wait"` for countdown-to-running; load Inter 900 or use 800; floor the timer display; match idle/running number sizes.

### Step 8: hygiene (C)
- Split `useWakeLock`, `useFullscreen` (feature-detected), `useIdleControls` out of `RepTimer.tsx`.
- One `Tempo` type and one shared phase table (label, colour, key); theme tokens for repeated hex values.
- Remove dead code and unused dependencies, rename the package, drop the Gemini define and stale descriptions.
- Enable `strict` and fix what it surfaces; add ESLint with `react-hooks`.

### Left out
Showing tempo or phase target on the timer card, surfacing pins outside the modal, a choice of starting phase, a landscape layout, reduced-motion handling.

## Verification
No tests exist; verification is type-check plus driving the app.
1. `npm install`; `npm run lint` and `npm run build` after each step.
2. `npm run dev`, phone-sized viewport, 2 reps x 2 sets with a short tempo, and once with HOLD = 0:
   - Countdown vibrates three times; tones on each phase change, none for zero-length phases; sound off silences tones only.
   - After rep 2: "SET 1 COMPLETE" / "START SET 2"; screen stays awake; steppers locked.
   - Ring tap pauses in one tap with controls hidden; resume shows 3-2-1 and restarts at LIFT; leave it paused-then-resumed 2+ minutes and the screen stays on (A1).
   - HOLD = 0: no red flash (A11). Finish: no orange flash, confetti once, also in fullscreen (A3, A4, A12); "NEW SESSION" returns to Rep 01 / Set 1.
   - Switch tabs mid-rep: paused on return, rep count unchanged (A9).
   - 60Hz display at each FPS option: evenly paced ring (B3); React Profiler shows about 10 commits/s while running (B4).
   - Phase colours cross-fade; Seamless toggle changes the duration (B1).
   - Reload restores reps, sets, tempo, FPS, seamless, sound.
   - Modal: Done, backdrop and Escape match; no duplicate entries; 51+ entries keep pins (A6); delete visible in touch emulation (A7); block storage in devtools, no crash (A8).
3. Open via `http://<lan-ip>:3000` on a phone: app loads (A14); check the *(verify)* items A15, B6, B7 there.

Platform limit: on iPhone the silent switch mutes web audio and vibration is unavailable.
