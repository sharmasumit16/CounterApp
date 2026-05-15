#pragma once

#include <atomic>
#include <functional>
#include <mutex>

/**
 * CounterLogic – all business rules for the counter, written in C++.
 *
 * Rules implemented here (not in JavaScript):
 *   1. Every 5th increment adds +5 instead of +1.
 *   2. Decrement is clamped to 0 (never goes negative).
 *   3. Gradual reset: steps down one unit at a time, calling onStep each tick.
 *   4. Auto-decrement: idles for a configurable timeout, then steps down
 *      periodically until interrupted by notifyInteraction().
 *
 * Thread-safety: all public methods are guarded by a mutex and safe to call
 * from any thread (the ObjC++ wrapper calls them from the main queue).
 */
class CounterLogic {
 public:
  // Callback types — both called on whatever thread fires the timer.
  using StepCallback = std::function<void(int newValue)>;
  using DoneCallback = std::function<void()>;

  static constexpr int kEveryNth       = 5;    // bonus increment every Nth call
  static constexpr int kBonusDelta     = 5;    // delta on the Nth increment
  static constexpr int kIdleMs         = 3000; // idle before auto-decrement
  static constexpr int kAutoTickMs     = 800;  // auto-decrement interval
  static constexpr int kResetTickMs    = 80;   // gradual-reset step interval

  explicit CounterLogic();
  ~CounterLogic();

  // Disable copy/move – owns dispatch objects.
  CounterLogic(const CounterLogic&) = delete;
  CounterLogic& operator=(const CounterLogic&) = delete;

  // ── Core operations ────────────────────────────────────────────────────────

  /** Applies the 5th-increment rule; returns the new value. */
  int increment();

  /** Clamps to 0; returns the new value. */
  int decrement();

  /**
   * Starts a gradual step-down to 0.
   * @param onStep  Called with the new value after each decrement step.
   * @param onDone  Called once when the value reaches 0.
   * Any in-progress gradual reset or auto-decrement is cancelled first.
   */
  void startReset(StepCallback onStep, DoneCallback onDone);

  /** Synchronous read – safe to call any time. */
  int getValue() const;

  /** Total number of times increment() has been called. */
  int getIncrementCount() const;

  /**
   * Must be called after every user interaction.
   * Cancels any running auto-decrement and restarts the idle countdown.
   * @param onAutoStep  Called each time auto-decrement fires.
   */
  void notifyInteraction(StepCallback onAutoStep);

  /** Cancel auto-decrement without restarting it (e.g. on teardown). */
  void cancelAutoDecrement();

 private:
  mutable std::mutex mutex_;

  int value_{0};
  int incrementCount_{0};

  // GCD timer handles (opaque pointers; treated as void* to keep the header
  // free of Objective-C / dispatch_source_t includes).
  void* resetTimer_{nullptr};
  void* idleTimer_{nullptr};
  void* autoTimer_{nullptr};

  void cancelTimer(void*& timerPtr);
  void cancelResetLocked();
  void cancelAutoLocked();
};
