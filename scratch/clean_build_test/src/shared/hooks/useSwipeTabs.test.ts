import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TouchEvent } from 'react';
import { useSwipeTabs } from './useSwipeTabs';

const TABS = ['a', 'b', 'c'] as const;
type Tab = (typeof TABS)[number];

const startEvent = (x: number, y: number, count = 1) =>
  ({
    touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
  }) as unknown as TouchEvent<HTMLElement>;

const endEvent = (x: number, y: number, count = 1) =>
  ({
    changedTouches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
  }) as unknown as TouchEvent<HTMLElement>;

function setup(activeTab: Tab, opts?: { disabled?: boolean }) {
  const onChange = vi.fn();
  const { result } = renderHook(() =>
    useSwipeTabs<Tab>({
      tabs: TABS,
      activeTab,
      onChange,
      disabled: opts?.disabled,
    }),
  );
  return { onChange, result };
}

describe('useSwipeTabs', () => {
  it('advances to the next tab on a leftward swipe', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(100, 210)); // dx=-100, dy=10
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('returns to the previous tab on a rightward swipe', () => {
    const { onChange, result } = setup('b');
    result.current.onTouchStart(startEvent(100, 200));
    result.current.onTouchEnd(endEvent(200, 205)); // dx=+100
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('ignores a swipe shorter than the minimum distance', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(160, 205)); // dx=-40
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a gesture with too much vertical drift', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(120, 300)); // dx=-80, dy=100
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores multi-touch gestures', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200, 2));
    result.current.onTouchEnd(endEvent(100, 205));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores gestures while disabled', () => {
    const { onChange, result } = setup('a', { disabled: true });
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(100, 205));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps at the first tab (no wraparound on rightward swipe)', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(100, 200));
    result.current.onTouchEnd(endEvent(200, 205)); // previous of 'a' → none
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps at the last tab (no wraparound on leftward swipe)', () => {
    const { onChange, result } = setup('c');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(100, 205)); // next of 'c' → none
    expect(onChange).not.toHaveBeenCalled();
  });
});
