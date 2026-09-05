# Open decisions — resolved 2026-09-05

The backend-hardening pass surfaced three deliberately-open items that needed a
policy call rather than a code fix. Recorded here so they are tracked decisions,
not silent gaps.

## 1. Anonymous-guest self-referral — ACCEPTED RISK

**Decision:** Accept and document the residual risk. No code change.

**Context.** Creator self-referral (a creator buying through their own link to
farm commission) is caught by two layers:

- **Checkout-time** (`CreatorService.resolveAttribution`) — rejects attribution
  when the buyer's server-verified identity (userId / creatorId from the JWT) or
  submitted email/phone matches the creator's registered identity.
- **Post-hoc, at credit time** (`CreatorService._detectPostHocSelfDealing`) —
  when a guest checkout later resolves to the creator's own buyer profile, the
  earning is flagged `flagged_for_review`, held from withdrawal, and written to
  `fraud_events` (which now also pushes a real-time alert — see #2).

**Residual gap.** A *fully unauthenticated* guest who uses *fresh* contact info
that never matches the creator's identity and never links to their buyer profile
cannot be distinguished from a legitimate buyer.

**Why accepted.** Byblos has no device / session / IP signal for a request that
never authenticates, so there is nothing to match on. The upside of gaming it is
small: the referral reward is capped at the platform fee, and forfeiting the
buyer-account link limits repeat abuse. Closing it fully would require either
forcing login on referral checkout (a conversion/adoption cost) or building
device-fingerprint / velocity fraud infrastructure (a separate project). Neither
is justified by the current risk.

**Revisit if:** referral-reward economics change materially, or abuse is observed
in the flagged-earnings review queue.

## 2. Detections-tab alerting — RESOLVED by real-time webhook

**Decision:** The webhook push added in the observability work is sufficient; no
additional admin surface for now.

Every flagged detection (`creator_self_referral_suspected`, payment amount
mismatch, missing order reference, etc.) writes a `fraud_events` row, and
`recordFraudEvent` now fire-and-forget pushes a real-time alert to
`ALERT_WEBHOOK_URL` (see `server/src/shared/utils/alerting.js` and
`docs/STAGING.md`). The Detections tab remains the pull-based review/resolution
queue. An in-app admin notification or a periodic digest were considered and
deferred — the real-time push covers the "nobody notices" concern.

## 3. Frontend test coverage — DEFERRED (tracked follow-up)

**Decision:** Out of scope for this backend-hardening pass; tracked as a
follow-up.

The frontend still has zero automated tests, including the Detections tab added
this session. The money-critical backend now has real unit + integration
coverage, which is where the risk concentrated. Bootstrapping a frontend suite
(Vitest + React Testing Library) is its own dedicated effort and should be
scoped separately. No frontend behavior is blocked by this; it is a
test-coverage debt to pay down deliberately, not a bug.
