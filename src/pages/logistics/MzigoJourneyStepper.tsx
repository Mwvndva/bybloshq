import { AlertTriangle, Check, Clock } from 'lucide-react';
import { JOURNEY_STEPS, type Journey } from './mzigoJourney';

/**
 * Horizontal 4-step progress bar shared by the courier console and the
 * buyer/seller tracking card. Done steps fill in, the current step pulses in
 * yellow, and a delayed/attention journey tints the current step.
 */
export function MzigoJourneyStepper({ journey, compact = false }: { journey: Journey; compact?: boolean }) {
  const currentTone = journey.state === 'attention'
    ? 'border-red-400 bg-red-400 text-black'
    : journey.state === 'delayed'
      ? 'border-amber-400 bg-amber-400 text-black'
      : 'border-yellow-400 bg-yellow-400 text-black';

  return (
    <div className="flex items-center">
      {JOURNEY_STEPS.map((step, index) => {
        const isDone = index < journey.stepIndex;
        const isCurrent = index === journey.stepIndex;
        const dotClass = isDone
          ? 'border-yellow-400/70 bg-yellow-400/20 text-yellow-300'
          : isCurrent
            ? currentTone
            : 'border-white/15 bg-white/[0.03] text-white/40';

        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex items-center justify-center rounded-full border ${dotClass} ${
                  compact ? 'h-6 w-6' : 'h-7 w-7'
                }`}
              >
                {isDone ? (
                  <Check size={compact ? 12 : 14} />
                ) : isCurrent && journey.state === 'attention' ? (
                  <AlertTriangle size={compact ? 12 : 14} />
                ) : isCurrent && journey.state === 'delayed' ? (
                  <Clock size={compact ? 12 : 14} />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-black' : 'bg-current'}`} />
                )}
              </span>
              {!compact && (
                <span
                  className={`text-[10px] font-semibold ${
                    isCurrent ? 'text-white' : isDone ? 'text-white/70' : 'text-white/35'
                  }`}
                >
                  {step.label}
                </span>
              )}
            </div>
            {index < JOURNEY_STEPS.length - 1 && (
              <span
                className={`mx-1 h-0.5 flex-1 rounded-full ${
                  index < journey.stepIndex ? 'bg-yellow-400/60' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
