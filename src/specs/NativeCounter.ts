/**
 * TurboModule spec for the native C++ counter.
 *
 * Codegen reads this file and emits:
 *   - ios: NativeCounterSpec.h  (the Objective-C protocol the module must conform to)
 *
 * All business logic lives in C++ (CounterLogic.cpp).
 * JavaScript only calls these methods and reacts to events.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // ── Core counter operations ─────────────────────────────────────────────────
  /** Applies the 5th-increment rule and returns the new value. */
  increment(): number;

  /** Decrements (min 0) and returns the new value. */
  decrement(): number;

  /**
   * Starts a gradual reset.  Native fires 'CounterValueChanged' events for
   * each step; 'CounterResetComplete' fires when the value reaches 0.
   */
  startReset(): void;

  /** Returns the current counter value (synchronous read). */
  getValue(): number;

  /** Returns the total number of increments performed so far. */
  getIncrementCount(): number;

  /**
   * Must be called after any user interaction so that the native idle timer
   * restarts (preventing auto-decrement while the user is active).
   */
  notifyInteraction(): void;

  // ── NativeEventEmitter required surface ────────────────────────────────────
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// Use get() (not getEnforcing) so a missing module returns null instead of
// throwing at module-load time. getEnforcing at module level crashes the
// entire JS runtime — including core modules like PlatformConstants — if the
// native binary doesn't have NativeCounter registered yet.
export default TurboModuleRegistry.get<Spec>('NativeCounter');
