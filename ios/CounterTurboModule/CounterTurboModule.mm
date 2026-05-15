#import "CounterTurboModule.h"
#import "CounterLogic.h"

@implementation CounterTurboModule {
  CounterLogic _logic;
}

// ── Module registration ────────────────────────────────────────────────────────

RCT_EXPORT_MODULE(NativeCounter)

- (NSArray<NSString *> *)supportedEvents {
  return @[@"CounterValueChanged", @"CounterResetComplete"];
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

// ── Synchronous methods ────────────────────────────────────────────────────────

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(increment) {
  return @(_logic.increment());
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(decrement) {
  return @(_logic.decrement());
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getValue) {
  return @(_logic.getValue());
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getIncrementCount) {
  return @(_logic.getIncrementCount());
}

// ── Fire-and-forget methods ────────────────────────────────────────────────────
//
// Use ObjC blocks (^{}) NOT C++ lambdas ([]{}) here.
// C++ lambdas cannot capture ObjC __weak references; ObjC blocks handle
// __weak/__strong correctly and are implicitly convertible to std::function.

RCT_EXPORT_METHOD(startReset) {
  __weak CounterTurboModule *weakSelf = self;

  _logic.startReset(
    ^(int newValue) {
      __strong CounterTurboModule *strongSelf = weakSelf;
      if (!strongSelf) return;
      [strongSelf sendEventWithName:@"CounterValueChanged"
                               body:@{@"value": @(newValue),
                                      @"prev":  @(newValue + 1)}];
    },
    ^{
      __strong CounterTurboModule *strongSelf = weakSelf;
      if (!strongSelf) return;
      [strongSelf sendEventWithName:@"CounterResetComplete" body:@{}];
    }
  );
}

RCT_EXPORT_METHOD(notifyInteraction) {
  __weak CounterTurboModule *weakSelf = self;

  _logic.notifyInteraction(^(int newValue) {
    __strong CounterTurboModule *strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf sendEventWithName:@"CounterValueChanged"
                             body:@{@"value": @(newValue),
                                    @"prev":  @(newValue + 1)}];
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

- (void)invalidate {
  _logic.cancelAutoDecrement();
  [super invalidate];
}

@end
