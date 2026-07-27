import { useRef, type TouchEvent } from 'react';

export interface UseSwipeTabsOptions<T extends string> {
  /** Ordered tab ids, left-to-right, matching the visible tab bar. */
  tabs: readonly T[];
  /** Currently active tab id. */
  activeTab: T;
  /** Called with the target tab id when a valid horizontal swipe completes. */
  onChange: (tab: T) => void;
  /** When true, all gestures are ignored (e.g. an overlay/sheet is open). */
  disabled?: boolean;
  /** Minimum horizontal travel to count as a swipe. Default 64. */
  minDistance?: number;
  /** Max vertical travel allowed; above this the gesture is treated as a
   *  scroll and ignored. Default 80. */
  maxVerticalDrift?: number;
}

export interface SwipeTabsHandlers {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
}

export function useSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  disabled = false,
  minDistance = 64,
  maxVerticalDrift = 80,
}: UseSwipeTabsOptions<T>): SwipeTabsHandlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (disabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || disabled || event.changedTouches.length !== 1) return;
    const index = tabs.indexOf(activeTab);
    if (index === -1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < minDistance || Math.abs(deltaY) > maxVerticalDrift) return;
    const target = tabs[deltaX < 0 ? index + 1 : index - 1];
    if (target) onChange(target);
  };

  const onTouchCancel = () => {
    startRef.current = null;
  };

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
