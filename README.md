# CounterApp

A React Native (TypeScript) counter application with non-trivial JavaScript logic and an advanced **C++ TurboModule** that moves all business rules to native code via JSI.

---

## Screenshots

<p align="center">
  <img src="assets/screenshots/image%20(2).png" width="280" alt="Native TurboModule Mode — Counter at 16"/>
</p>

<p align="center"><b>Native TurboModule Mode</b> — All business logic runs in C++ via JSI. Counter at 16, recent values visible in the history strip.</p>

<br/>

<table>
  <tr>
    <td align="center"><b>JS Mode — Counting</b></td>
    <td align="center"><b>Native Mode — Reset State</b></td>
    <td align="center"><b>Native Mode — Counting</b></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/image%20(4).png" width="220" alt="JS Mode"/></td>
    <td><img src="assets/screenshots/image%20(3).png" width="220" alt="Native TurboModule Mode — Zero"/></td>
    <td><img src="assets/screenshots/image%20(2).png" width="220" alt="Native TurboModule Mode — Counting"/></td>
  </tr>
  <tr>
    <td align="center">JS implementation<br/>counter at 8<br/>recent history shown</td>
    <td align="center">TurboModule · C++ logic<br/>counter reset to 0<br/>Decrement &amp; Reset disabled</td>
    <td align="center">TurboModule · counter at 16<br/>full history strip<br/>all buttons active</td>
  </tr>
</table>

---

## Features at a Glance

| Feature | Detail |
|---------|--------|
| Every 5th increment | Adds +5 instead of +1 |
| Decrement floor | Counter never goes below 0 |
| Auto-decrement | Starts after 3 s of idle time |
| Gradual reset | Steps down one unit every 80 ms |
| Value history | Last 10 values shown as a scrollable chip strip |
| Long-press `+` | Rapid increment while held |
| Mode toggle | Switch between JS and Native (TurboModule) at runtime |

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [JavaScript Implementation](#javascript-implementation)
   - [Logic Structure](#logic-structure)
   - [State Management](#state-management)
   - [Non-trivial Behaviors](#non-trivial-behaviors)
   - [Optional Improvements](#optional-improvements)
3. [TurboModule Implementation (Advanced)](#turbomodule-implementation-advanced)
   - [Architecture Overview](#architecture-overview)
   - [C++ Layer: CounterLogic](#c-layer-counterlogic)
   - [Objective-C++ Bridge: CounterTurboModule](#objective-c-bridge-counterturbomodule)
   - [JS Spec: NativeCounter](#js-spec-nativecounter)
   - [Data Flow](#data-flow)
   - [Key Differences: JS vs Native](#key-differences-js-vs-native)
4. [Project Structure](#project-structure)
5. [Challenges and Tradeoffs](#challenges-and-tradeoffs)

---

## Getting Started

### Prerequisites

- Node.js >= 22.11.0
- Xcode 15+ with iOS 13.4+ simulator
- Ruby / CocoaPods

### Install

```bash
git clone https://github.com/sharmasumit16/CounterApp.git
cd CounterApp
npm install
cd ios && pod install && cd ..
```

### Run (iOS)

```bash
# Terminal 1 — keep Metro running
npx react-native start

# Terminal 2 (or use Xcode)
npx react-native run-ios
```

Or open `ios/CounterApp.xcworkspace` in Xcode and press **⌘R**.

> **Important:** Always open the `.xcworkspace` file, not `.xcodeproj`.

---

## JavaScript Implementation

### Logic Structure

```
src/
├── hooks/
│   ├── useCounter.ts        # Pure JS counter logic (useReducer + timers)
│   └── useNativeCounter.ts  # TurboModule bridge hook (same API as useCounter)
├── screens/
│   └── CounterScreen.tsx    # Single screen — wires hooks to UI via mode toggle
└── components/
    ├── CounterDisplay.tsx   # Animated value display (scale-pulse on change)
    ├── CounterButtons.tsx   # +  /  −  /  Reset with long-press support
    └── HistoryList.tsx      # Horizontal chip strip of last 10 values
```

All business rules live in `useCounter.ts`. Components are purely presentational — they receive callbacks and render from props only, making them fully reusable across both modes.

### State Management

State is managed with **`useReducer`** inside `useCounter`. Chosen over multiple `useState` calls because:

- All related fields (`value`, `history`, `isResetting`, `incrementCount`) update atomically in a single dispatch — no torn renders.
- The reducer is a plain function — fully testable without mocking.
- Named action types (`INCREMENT`, `DECREMENT`, `RESET_STEP`, …) create an explicit, auditable vocabulary of state transitions.

**Stale-closure problem** in timer callbacks is solved by mirroring state to a `stateRef` via `useEffect`. Timers always read `stateRef.current` (always fresh) and call the stable `dispatch` from `useReducer`.

```
Timer / Event ──dispatch(action)──► Reducer ──► new state
     ▲                                               │
     └──── stateRef.current ◄── useEffect ───────────┘
           (always up to date)
```

### Non-trivial Behaviors

| # | Behavior | How it works |
|---|----------|--------------|
| 1 | **Every 5th increment adds +5** | `incrementCount` lives in reducer state. On each `INCREMENT` action: `(incrementCount + 1) % 5 === 0 ? delta = 5 : delta = 1` |
| 2 | **Decrement never goes below 0** | `DECREMENT` case returns unchanged state when `value <= 0` |
| 3 | **Auto-decrement after 3 s idle** | `recordInteraction()` clears + restarts a 3 s `setTimeout`. On fire, a `setInterval` dispatches `AUTO_DECREMENT` every 800 ms |
| 4 | **Gradual reset** | `reset()` dispatches `RESET_START`, then a `setInterval` dispatches `RESET_STEP` every 80 ms until `stateRef.current.value <= 0` |

All four behaviors interact correctly:
- User interaction during auto-decrement cancels it instantly
- `reset()` is a no-op while already resetting (`isResetting` guard)
- Long-press increments fully respect the 5th-increment rule

### Optional Improvements

- **Value history** — `HistoryList` renders the last 10 values as a horizontal chip strip. The most-recent entry is highlighted in dark navy. History is part of reducer state so it always updates atomically with `value`.
- **Long-press fast increment** — Holding `+` fires one immediate increment, waits 400 ms (hold threshold), then fires at 100 ms intervals until `onPressOut`. Uses `startLongPressIncrement` / `stopLongPress` ref-based timers.

---

## TurboModule Implementation (Advanced)

### Architecture Overview

```
JavaScript (UI only)                    Native (C++)
────────────────────                    ─────────────────────────────
CounterScreen.tsx                       CounterTurboModule.mm
  │  synchronous JSI calls                │  Objective-C++ wrapper
  ▼                                       ▼
useNativeCounter.ts  ◄──events────────  CounterLogic.cpp
  │  NativeEventEmitter                     All business rules in C++
  │  subscribes to events                   GCD timers for auto-decrement
  ▼                                         and gradual reset
CounterDisplay / Buttons
```

In Native mode the JavaScript layer contains **zero business logic** — it calls into C++ and reacts to events.

### C++ Layer: CounterLogic

**File:** `ios/CounterTurboModule/CounterLogic.h` + `CounterLogic.cpp`

`CounterLogic` is a plain C++ class with no Objective-C dependency:

| Member | Purpose |
|--------|---------|
| `value_` / `incrementCount_` | Counter state |
| `resetTimer_` (GCD source) | Drives gradual step-down |
| `idleTimer_` (GCD source) | One-shot delay before auto-decrement |
| `autoTimer_` (GCD source) | Repeating auto-decrement tick |
| `mutex_` | Guards all state for thread safety |

All GCD timers fire on the main queue — no races with UI callbacks.

```
increment()                       →  applies 5th-rule; returns new value
decrement()                       →  clamps to 0; returns new value
startReset(onStep, onDone)        →  fires onStep(n) every 80 ms; onDone() at 0
notifyInteraction(onAutoStep)     →  restarts 3 s idle → auto-decrement pipeline
cancelAutoDecrement()             →  teardown on module invalidation
```

### Objective-C++ Bridge: CounterTurboModule

**File:** `ios/CounterTurboModule/CounterTurboModule.h` + `.mm`

`CounterTurboModule` extends `RCTEventEmitter` and owns an embedded `CounterLogic` instance.

```objc
// Synchronous (RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD)
// Called via JSI — zero bridge serialization overhead
increment, decrement, getValue, getIncrementCount

// Fire-and-forget (RCT_EXPORT_METHOD)
// Native emits events asynchronously for each step
startReset, notifyInteraction
```

Events emitted to JavaScript:

| Event | Payload | Fired when |
|-------|---------|------------|
| `CounterValueChanged` | `{ value: number, prev: number }` | Each auto-decrement or reset step |
| `CounterResetComplete` | `{}` | Gradual reset reaches 0 |

> **Why ObjC blocks, not C++ lambdas?**  
> `__weak`/`__strong` ARC semantics only apply to ObjC blocks (`^{}`). C++ lambda captures (`[]{}`) do not propagate ARC, causing compile errors. Both are implicitly convertible to `std::function<>` in Clang, so `CounterLogic`'s callbacks accept either.

### JS Spec: NativeCounter

**File:** `src/specs/NativeCounter.ts`

```typescript
export interface Spec extends TurboModule {
  increment(): number;           // synchronous via JSI
  decrement(): number;           // synchronous via JSI
  startReset(): void;
  getValue(): number;            // synchronous via JSI
  getIncrementCount(): number;   // synchronous via JSI
  notifyInteraction(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}
```

This file is read by **React Native Codegen** (run automatically during `pod install`) which generates `NativeCounterCxxSpec.h` — enforcing type correctness between JS and native at compile time.

### Data Flow

```
User taps "+"
    │
    ▼
useNativeCounter.increment()
    │  reads prev synchronously via JSI (getValue)
    │  calls nativeModule.increment() → CounterLogic::increment()
    │  C++ applies 5th-rule, returns new int via JSI
    ▼
JS: setValue(next) + pushHistory(prev) → CounterDisplay re-renders

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

3 s idle (no notifyInteraction call)
    │
    ▼
GCD idle timer fires → starts repeating auto-decrement timer (800 ms)
    │
    ▼  each tick
CounterLogic decrements value_
    │  fires CounterValueChanged event via RCTEventEmitter
    ▼
NativeEventEmitter listener in useNativeCounter
    │  setValue + pushHistory
    ▼
CounterDisplay re-renders
```

### Key Differences: JS vs Native

| Concern | JavaScript | Native TurboModule |
|---------|------------|--------------------|
| **Business logic location** | `useCounter.ts` | `CounterLogic.cpp` |
| **Timer mechanism** | `setTimeout` / `setInterval` (JS event loop) | GCD `dispatch_source_t` (OS thread pool) |
| **Method call overhead** | Direct JS function call | JSI — no JSON serialization |
| **State updates** | `useReducer` dispatch | `std::mutex`-guarded C++ + event emission |
| **Event delivery** | Direct state mutation | `RCTEventEmitter` → `NativeEventEmitter` |
| **Thread safety** | Single-threaded JS engine | `std::mutex` + GCD main-queue dispatch |
| **Gradual reset** | JS `setInterval` + reducer | GCD repeating timer + C++ callbacks |
| **Auto-decrement** | JS `setTimeout` + `setInterval` | GCD one-shot + repeating timers |
| **Build complexity** | None — pure JS | Xcode + CocoaPods + codegen required |

---

## Project Structure

```
CounterApp/
├── App.tsx                          Entry point
├── assets/
│   └── screenshots/                 App screenshots
├── src/
│   ├── hooks/
│   │   ├── useCounter.ts            JS logic (useReducer + timers)
│   │   └── useNativeCounter.ts      TurboModule bridge hook
│   ├── screens/
│   │   └── CounterScreen.tsx        Main screen + mode toggle
│   ├── components/
│   │   ├── CounterDisplay.tsx       Animated value display
│   │   ├── CounterButtons.tsx       + / − / Reset (long-press support)
│   │   └── HistoryList.tsx          Recent-values chip strip
│   └── specs/
│       └── NativeCounter.ts         TurboModule JS spec (codegen input)
├── ios/
│   ├── Podfile                      CounterTurboModule pod included
│   └── CounterTurboModule/
│       ├── CounterLogic.h           C++ interface
│       ├── CounterLogic.cpp         C++ business logic + GCD timers
│       ├── CounterTurboModule.h     ObjC header
│       ├── CounterTurboModule.mm    ObjC++ bridge (RCTEventEmitter)
│       └── CounterTurboModule.podspec
└── README.md
```

---

## Challenges and Tradeoffs

### 1. Stale closures in JS timers
Timer callbacks close over state at creation time — reading `state.value` inside a `setInterval` gives a stale snapshot.

**Solution:** Mirror reducer state to `stateRef` via `useEffect`. Timers read `stateRef.current` (always current) and call stable `dispatch`.

### 2. Side effects inside setState updaters
Clearing intervals inside a `setState` updater is unsafe — React 18 may invoke updaters twice in Strict Mode.

**Solution:** All timer teardown happens outside `setState`, in the interval callback body after reading from `stateRef`.

### 3. Gradual reset cancellation
If the user taps Reset while auto-decrement is running, both must be cleanly cancelled before starting the new reset.

**Solution:** `reset()` calls `clearAutoDecrement()` and `clearReset()` before starting a new interval. The C++ layer mirrors this with `cancelResetLocked()` + `cancelAutoLocked()` inside `startReset`.

### 4. C++ lambdas vs ObjC blocks
C++ lambdas (`[weakSelf]{}`) cannot capture ObjC `__weak` references — the compiler throws "undeclared identifier 'weakSelf'".

**Solution:** Use ObjC blocks (`^{}`) in `.mm` files. Blocks are ARC-aware and implicitly convert to `std::function<>` in Clang, so `CounterLogic`'s `std::function` callbacks accept them seamlessly.

### 5. ARC must be enabled for the `.mm` bridge
The podspec originally had `requires_arc = false` (intending to exclude the `.cpp` file). This disabled ARC for `CounterTurboModule.mm` too, breaking `__weak`.

**Solution:** `requires_arc = true` — ARC only affects `.m`/`.mm` files; `.cpp` files are always compiled as plain C++ regardless of this setting.

### 6. GCD timer ownership in plain C++
`dispatch_source_t` is an ARC-managed ObjC object, but `CounterLogic.cpp` is compiled as pure C++ (no ARC). Storing it as `void*` avoids the ARC-in-C++ problem while maintaining correct cancellation semantics via `dispatch_source_cancel`.

### 7. TurboModule registry timing (`PlatformConstants` error)
Calling `TurboModuleRegistry.getEnforcing('NativeCounter')` at module-load level in the spec file throws if the native runtime isn't ready yet — and that exception can cascade, preventing even core modules like `PlatformConstants` from loading.

**Solution:** Changed to `TurboModuleRegistry.get(...)` (returns `null` instead of throwing). The bridge hook handles `null` gracefully with a JS-only fallback.
