import { useReducer, useRef, useCallback, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_HISTORY = 10;
const EVERY_NTH_INCREMENT = 5;     // every 5th increment adds 5 instead of 1
const BONUS_DELTA = 5;
const AUTO_DECREMENT_IDLE_MS = 3000;  // idle time before auto-decrement starts
const AUTO_DECREMENT_TICK_MS = 800;   // interval between each auto-decrement
const GRADUAL_RESET_TICK_MS = 80;     // interval between each reset step
const LONG_PRESS_INITIAL_DELAY = 400; // ms before fast-increment kicks in
const LONG_PRESS_TICK_MS = 100;       // tick rate while holding

// ─── State shape ─────────────────────────────────────────────────────────────
interface CounterState {
  value: number;
  history: number[];   // most-recent first
  isResetting: boolean;
  incrementCount: number; // total increments so far (drives the 5th-rule)
}

const initialState: CounterState = {
  value: 0,
  history: [],
  isResetting: false,
  incrementCount: 0,
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
type Action =
  | { type: 'INCREMENT'; delta: number }
  | { type: 'DECREMENT' }
  | { type: 'AUTO_DECREMENT' }
  | { type: 'RESET_START' }
  | { type: 'RESET_STEP' }
  | { type: 'RESET_COMPLETE' };

function pushHistory(history: number[], prev: number): number[] {
  return [prev, ...history].slice(0, MAX_HISTORY);
}

function reducer(state: CounterState, action: Action): CounterState {
  switch (action.type) {
    case 'INCREMENT':
      return {
        ...state,
        value: state.value + action.delta,
        history: pushHistory(state.history, state.value),
        incrementCount: state.incrementCount + 1,
      };

    case 'DECREMENT':
      if (state.value <= 0) return state;
      return {
        ...state,
        value: state.value - 1,
        history: pushHistory(state.history, state.value),
      };

    case 'AUTO_DECREMENT':
      if (state.value <= 0) return state;
      return {
        ...state,
        value: state.value - 1,
        history: pushHistory(state.history, state.value),
      };

    case 'RESET_START':
      return { ...state, isResetting: true };

    case 'RESET_STEP':
      if (state.value <= 0) return { ...state, value: 0 };
      return {
        ...state,
        value: state.value - 1,
        history: pushHistory(state.history, state.value),
      };

    case 'RESET_COMPLETE':
      return { ...state, isResetting: false };

    default:
      return state;
  }
}

// ─── Hook public surface ──────────────────────────────────────────────────────
export interface UseCounterReturn {
  value: number;
  history: number[];
  isResetting: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  startLongPressIncrement: () => void;
  stopLongPress: () => void;
}

export function useCounter(): UseCounterReturn {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Mirror current state in a ref so timer callbacks always see fresh values
  // without re-registering (avoids stale-closure bugs in intervals/timeouts).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Timer refs ──────────────────────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDecrementRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timer helpers ───────────────────────────────────────────────────────────
  const clearAutoDecrement = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (autoDecrementRef.current !== null) {
      clearInterval(autoDecrementRef.current);
      autoDecrementRef.current = null;
    }
  }, []);

  const clearReset = useCallback(() => {
    if (resetIntervalRef.current !== null) {
      clearInterval(resetIntervalRef.current);
      resetIntervalRef.current = null;
    }
  }, []);

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

  // Schedules the idle → auto-decrement pipeline.
  const scheduleAutoDecrement = useCallback(() => {
    clearAutoDecrement();
    idleTimerRef.current = setTimeout(() => {
      autoDecrementRef.current = setInterval(() => {
        if (stateRef.current.value <= 0 || stateRef.current.isResetting) {
          clearAutoDecrement();
          return;
        }
        dispatch({ type: 'AUTO_DECREMENT' });
      }, AUTO_DECREMENT_TICK_MS);
    }, AUTO_DECREMENT_IDLE_MS);
  }, [clearAutoDecrement]);

  // Called on any user interaction to reset the idle clock.
  const recordInteraction = useCallback(() => {
    clearAutoDecrement();
    if (!stateRef.current.isResetting) {
      scheduleAutoDecrement();
    }
  }, [clearAutoDecrement, scheduleAutoDecrement]);

  // ── Core actions ────────────────────────────────────────────────────────────
  const increment = useCallback(() => {
    if (stateRef.current.isResetting) return;

    recordInteraction();

    // Next incrementCount (after this dispatch) drives the 5th rule.
    const nextCount = stateRef.current.incrementCount + 1;
    const delta = nextCount % EVERY_NTH_INCREMENT === 0 ? BONUS_DELTA : 1;
    dispatch({ type: 'INCREMENT', delta });
  }, [recordInteraction]);

  const decrement = useCallback(() => {
    if (stateRef.current.isResetting) return;
    if (stateRef.current.value <= 0) return;

    recordInteraction();
    dispatch({ type: 'DECREMENT' });
  }, [recordInteraction]);

  const reset = useCallback(() => {
    if (stateRef.current.isResetting) return;
    if (stateRef.current.value === 0) return;

    clearAutoDecrement();
    clearReset();
    clearLongPress();

    dispatch({ type: 'RESET_START' });

    // Gradual step-down: one unit per tick until we reach 0.
    resetIntervalRef.current = setInterval(() => {
      if (stateRef.current.value <= 0) {
        clearReset();
        dispatch({ type: 'RESET_COMPLETE' });
        scheduleAutoDecrement();
        return;
      }
      dispatch({ type: 'RESET_STEP' });
    }, GRADUAL_RESET_TICK_MS);
  }, [clearAutoDecrement, clearReset, clearLongPress, scheduleAutoDecrement]);

  // ── Long-press fast increment ───────────────────────────────────────────────
  const startLongPressIncrement = useCallback(() => {
    if (stateRef.current.isResetting) return;

    // Fire one immediate increment, then wait for the hold delay.
    increment();

    longPressDelayRef.current = setTimeout(() => {
      longPressTickRef.current = setInterval(() => {
        if (stateRef.current.isResetting) {
          clearLongPress();
          return;
        }
        recordInteraction();
        const nextCount = stateRef.current.incrementCount + 1;
        const delta = nextCount % EVERY_NTH_INCREMENT === 0 ? BONUS_DELTA : 1;
        dispatch({ type: 'INCREMENT', delta });
      }, LONG_PRESS_TICK_MS);
    }, LONG_PRESS_INITIAL_DELAY);
  }, [increment, recordInteraction, clearLongPress]);

  const stopLongPress = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    scheduleAutoDecrement(); // start idle clock on mount
    return () => {
      clearAutoDecrement();
      clearReset();
      clearLongPress();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    value: state.value,
    history: state.history,
    isResetting: state.isResetting,
    increment,
    decrement,
    reset,
    startLongPressIncrement,
    stopLongPress,
  };
}
