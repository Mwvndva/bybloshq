import React from 'react';
import { ScaledFounderCard } from './FounderCard';

/**
 * MANDATORY FOUNDER CARD INTEGRATION INSTRUCTIONS:
 * 
 * 1. Wrap with ScaledFounderCard, never FounderCard directly, in any container with unknown/fluid width.
 * 2. Any flex or grid ancestor wrapping the card needs min-width: 0 (Tailwind: min-w-0) on the item containing it —
 *    this is not optional, it's the verified fix. If a future integration point stretches again, check this first before touching the component itself.
 */
export function FounderCardExample({ memberNumber = 42 }: { memberNumber?: number }) {
  return (
    // Example parent flex or grid item containing the card (must include min-w-0)
    <div className="flex-1 min-w-0 space-y-3">
      {/* 1. Fluid container with constrained max-width */}
      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl">
        {/* 2. ScaledFounderCard automatically handles scaling via CSS transform */}
        <ScaledFounderCard memberNumber={memberNumber} />
      </div>
    </div>
  );
}

export default FounderCardExample;
