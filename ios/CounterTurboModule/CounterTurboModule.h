#pragma once

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * NativeCounter TurboModule
 *
 * Bridges the C++ CounterLogic class to JavaScript via JSI/TurboModule.
 * All business logic lives in CounterLogic.cpp; this file is pure plumbing.
 *
 * Events emitted:
 *   - CounterValueChanged  { value: number, prev: number }
 *     Fired by auto-decrement and gradual reset on every step.
 *
 *   - CounterResetComplete  {}
 *     Fired when gradual reset reaches 0.
 */
@interface CounterTurboModule : RCTEventEmitter <RCTBridgeModule>

@end
