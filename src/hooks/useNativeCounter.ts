/**
 * Bridge hook that delegates all counter logic to the native TurboModule.
 * JavaScript is responsible only for display state and button wiring —
 * the C++ layer owns all business logic.
 *
 * Falls back gracefully when the TurboModule is not present (e.g. running
 * in Metro without a native build).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { UseCounterReturn } from './useCounter';

// Lazily resolve the module so the app doesn't crash when running without
// the native layer compiled in.
function getNativeModule(): Record<string, unknown> | null {
  try {
    const { TurboModuleRegistry } = require('react-native');
    const mod = TurboModuleRegistry.get?.('NativeCounter') ??
                NativeModules.NativeCounter ??
                null;
    return mod as Record<string, unknown> | null;
  } catch {
    return (NativeModules.NativeCounter as Record<string, unknown>) ?? null;
  }
}

const MAX_HISTORY = 10;
const LONG_PRESS_INITIAL_DELAY = 400;
const LONG_PRESS_TICK_MS = 100;

export interface UseNativeCounterReturn extends UseCounterReturn {
  isAvailable: boolean;
}

export function useNativeCounter(): UseNativeCounterReturn {
  const nativeModule = useRef(getNativeModule()).current;
  const isAvailable = nativeModule !== null && Platform.OS === 'ios';

  const readValue = useCallback((): number => {
    if (!isAvailable) return 0;
    return (nativeModule!.getValue as () => number)();
  }, [isAvailable, nativeModule]);

  const [value, setValue] = useState<number>(() => readValue());
  const [history, setHistory] = useState<number[]>([]);
  const [isResetting, setIsResetting] = useState(false);

  const isResettingRef = useRef(isResetting);
  useEffect(() => {
    isResettingRef.current = isResetting;
  }, [isResetting]);

  const longPressDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushHistory = useCallback((prev: number) => {
    setHistory(h => [prev, ...h].slice(0, MAX_HISTORY));
  }, []);

  // ── Subscribe to native events ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAvailable) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emitter = new NativeEventEmitter(nativeModule as any);

    const valueSub = emitter.addListener(
      'CounterValueChanged',
      (data: { value: number; prev: number }) => {
        pushHistory(data.prev);
        setValue(data.value);
      },
    );

    const resetSub = emitter.addListener('CounterResetComplete', () => {
      setIsResetting(false);
      setValue(0);
    });

    return () => {
      valueSub.remove();
      resetSub.remove();
    };
  }, [isAvailable, nativeModule, pushHistory]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const increment = useCallback(() => {
    if (!isAvailable || isResettingRef.current) return;
    const prev = readValue();
    // increment() is synchronous (RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD)
    const next = (nativeModule!.increment as () => number)();
    pushHistory(prev);
    setValue(next);
    (nativeModule!.notifyInteraction as () => void)();
  }, [isAvailable, nativeModule, readValue, pushHistory]);

  const decrement = useCallback(() => {
    if (!isAvailable || isResettingRef.current) return;
    const prev = readValue();
    if (prev <= 0) return;
    const next = (nativeModule!.decrement as () => number)();
    pushHistory(prev);
    setValue(next);
    (nativeModule!.notifyInteraction as () => void)();
  }, [isAvailable, nativeModule, readValue, pushHistory]);

  const reset = useCallback(() => {
    if (!isAvailable || isResettingRef.current) return;
    if (readValue() === 0) return;
    setIsResetting(true);
    (nativeModule!.startReset as () => void)();
  }, [isAvailable, nativeModule, readValue]);

  // ── Long-press fast increment ──────────────────────────────────────────────

  const clearLongPress = useCallback(() => {
    if (longPressDelayRef.current !== null) {
      clearTimeout(longPressDelayRef.current);
      longPressDelayRef.current = null;
    }
    if (longPressTickRef.current !== null) {
      clearInterval(longPressTickRef.current);
      longPressTickRef.current = null;
    }
  }, []);

  const startLongPressIncrement = useCallback(() => {
    if (!isAvailable || isResettingRef.current) return;
    increment(); // immediate first press

    longPressDelayRef.current = setTimeout(() => {
      longPressTickRef.current = setInterval(() => {
        if (isResettingRef.current) {
          clearLongPress();
          return;
        }
        const prev = readValue();
        const next = (nativeModule!.increment as () => number)();
        pushHistory(prev);
        setValue(next);
        (nativeModule!.notifyInteraction as () => void)();
      }, LONG_PRESS_TICK_MS);
    }, LONG_PRESS_INITIAL_DELAY);
  }, [isAvailable, increment, nativeModule, readValue, pushHistory, clearLongPress]);

  const stopLongPress = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => { clearLongPress(); }, [clearLongPress]);

  // Provide a no-op fallback when native is unavailable.
  if (!isAvailable) {
    return {
      isAvailable: false,
      value: 0,
      history: [],
      isResetting: false,
      increment: () => {},
      decrement: () => {},
      reset: () => {},
      startLongPressIncrement: () => {},
      stopLongPress: () => {},
    };
  }

  return {
    isAvailable: true,
    value,
    history,
    isResetting,
    increment,
    decrement,
    reset,
    startLongPressIncrement,
    stopLongPress,
  };
}
