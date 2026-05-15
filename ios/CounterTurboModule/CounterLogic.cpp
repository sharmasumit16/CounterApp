#include "CounterLogic.h"
#include <dispatch/dispatch.h>

// ── Timer helpers ─────────────────────────────────────────────────────────────
// We store dispatch_source_t handles as void* in the header to keep it
// platform-agnostic; cast back here.

static dispatch_source_t makeRepeatingTimer(
    uint64_t intervalNs,
    dispatch_block_t block) {
  dispatch_source_t timer = dispatch_source_create(
      DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
  dispatch_source_set_timer(
      timer,
      dispatch_time(DISPATCH_TIME_NOW, (int64_t)intervalNs),
      intervalNs,
      /* leeway */ 10 * NSEC_PER_MSEC);
  dispatch_source_set_event_handler(timer, block);
  dispatch_resume(timer);
  return timer;
}

static dispatch_source_t makeOneShotTimer(
    uint64_t delayNs,
    dispatch_block_t block) {
  dispatch_source_t timer = dispatch_source_create(
      DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
  dispatch_source_set_timer(
      timer,
      dispatch_time(DISPATCH_TIME_NOW, (int64_t)delayNs),
      DISPATCH_TIME_FOREVER,
      /* leeway */ 10 * NSEC_PER_MSEC);
  dispatch_source_set_event_handler(timer, ^{
    block();
    dispatch_source_cancel(timer);
  });
  dispatch_resume(timer);
  return timer;
}

// ── CounterLogic ──────────────────────────────────────────────────────────────

CounterLogic::CounterLogic() = default;

CounterLogic::~CounterLogic() {
  std::lock_guard<std::mutex> lock(mutex_);
  cancelResetLocked();
  cancelAutoLocked();
}

void CounterLogic::cancelTimer(void*& timerPtr) {
  if (timerPtr != nullptr) {
    dispatch_source_t src = reinterpret_cast<dispatch_source_t>(timerPtr);
    dispatch_source_cancel(src);
    // Release the retained source.  dispatch_source_create returns a retained
    // object in ARC-disabled translation units (this is a .cpp file).
    // Using __bridge_transfer would require ObjC ARC; instead release manually.
    // In practice the block captures the source so it stays alive until cancel.
    timerPtr = nullptr;
  }
}

void CounterLogic::cancelResetLocked() {
  cancelTimer(resetTimer_);
}

void CounterLogic::cancelAutoLocked() {
  cancelTimer(idleTimer_);
  cancelTimer(autoTimer_);
}

// ── Public API ────────────────────────────────────────────────────────────────

int CounterLogic::increment() {
  std::lock_guard<std::mutex> lock(mutex_);
  incrementCount_ += 1;
  int delta = (incrementCount_ % kEveryNth == 0) ? kBonusDelta : 1;
  value_ += delta;
  return value_;
}

int CounterLogic::decrement() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (value_ > 0) {
    value_ -= 1;
  }
  return value_;
}

void CounterLogic::startReset(StepCallback onStep, DoneCallback onDone) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    cancelResetLocked();
    cancelAutoLocked();

    if (value_ == 0) {
      // Nothing to do.
      dispatch_async(dispatch_get_main_queue(), ^{
        onDone();
      });
      return;
    }
  }

  // Capture `this` — CounterLogic outlives the module (torn down together).
  uint64_t intervalNs = (uint64_t)kResetTickMs * NSEC_PER_MSEC;
  dispatch_source_t timer = makeRepeatingTimer(intervalNs, ^{
    int current;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (value_ <= 0) {
        cancelResetLocked();
        dispatch_async(dispatch_get_main_queue(), ^{ onDone(); });
        return;
      }
      value_ -= 1;
      current = value_;
    }
    onStep(current);
    if (current == 0) {
      std::lock_guard<std::mutex> lock2(mutex_);
      cancelResetLocked();
    }
  });

  {
    std::lock_guard<std::mutex> lock(mutex_);
    resetTimer_ = reinterpret_cast<void*>(timer);
  }
}

int CounterLogic::getValue() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return value_;
}

int CounterLogic::getIncrementCount() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return incrementCount_;
}

void CounterLogic::notifyInteraction(StepCallback onAutoStep) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    cancelAutoLocked();
  }

  // After idle timeout, start auto-decrement interval.
  uint64_t idleNs = (uint64_t)kIdleMs * NSEC_PER_MSEC;
  dispatch_source_t idle = makeOneShotTimer(idleNs, ^{
    uint64_t tickNs = (uint64_t)kAutoTickMs * NSEC_PER_MSEC;
    dispatch_source_t autoTmr = makeRepeatingTimer(tickNs, ^{
      int newVal;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        if (value_ <= 0) {
          cancelAutoLocked();
          return;
        }
        value_ -= 1;
        newVal = value_;
      }
      onAutoStep(newVal);
    });
    {
      std::lock_guard<std::mutex> lock(mutex_);
      autoTimer_ = reinterpret_cast<void*>(autoTmr);
    }
  });

  {
    std::lock_guard<std::mutex> lock(mutex_);
    idleTimer_ = reinterpret_cast<void*>(idle);
  }
}

void CounterLogic::cancelAutoDecrement() {
  std::lock_guard<std::mutex> lock(mutex_);
  cancelAutoLocked();
}
