import { useRef, type TouchEvent } from 'react';

const SWIPE_NAV_SECTIONS = ['shop', 'shops', 'wishlist', 'orders'] as const;
const SWIPE_MIN_DISTANCE = 64;
const SWIPE_MAX_VERTICAL_DRIFT = 80;
type SwipeSection = (typeof SWIPE_NAV_SECTIONS)[number];

export function useBuyerSwipeNav(
  activeSection: string,
  isProfileSidebarOpen: boolean,
  setActiveTab: (section: SwipeSection) => void,
) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (isProfileSidebarOpen || event.touches.length !== 1) return;
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || isProfileSidebarOpen || event.changedTouches.length !== 1) return;
    if (!SWIPE_NAV_SECTIONS.includes(activeSection as SwipeSection)) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaY) > SWIPE_MAX_VERTICAL_DRIFT) return;
    const currentIndex = SWIPE_NAV_SECTIONS.indexOf(activeSection as SwipeSection);
    const targetSection = SWIPE_NAV_SECTIONS[deltaX < 0 ? currentIndex + 1 : currentIndex - 1];
    if (targetSection) setActiveTab(targetSection);
  };

  return { onTouchStart, onTouchEnd };
}
