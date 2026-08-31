// Byblos load test (k6). Exercises the read-heavy PUBLIC hot paths at scale.
// It deliberately does NOT touch payment initiation (real money) or authed
// endpoints. Run against a STAGING deploy, never production.
//
//   BASE_URL=https://byblos-staging.example.com \
//   ORDER_NUMBER=ORD-20260831-000042 \
//   k6 run scripts/load/byblos-load.k6.js
//
// The order-status poll is the path this pass indexed (payments.metadata->>'order_id');
// pass a real paid ORDER_NUMBER from staging to exercise it, otherwise it's skipped.
import http from 'k6/http';
import { check } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://localhost:10000').replace(/\/+$/, '');
const ORDER_NUMBER = __ENV.ORDER_NUMBER || '';
const PEAK = Number(__ENV.PEAK_RPS || 500);

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1200,
      stages: [
        { target: 100, duration: '1m' },
        { target: 300, duration: '2m' },
        { target: PEAK, duration: '3m' }, // sustain peak
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],                        // <1% errors overall
    'http_req_duration{endpoint:poll}': ['p(95)<500'],      // order-status poll p95 < 500ms
    'http_req_duration{endpoint:catalog}': ['p(95)<800'],
    'http_req_duration{endpoint:search}': ['p(95)<1000'],
    'http_req_duration{endpoint:health}': ['p(95)<200'],
  },
};

export default function () {
  const r = Math.random();
  if (r < 0.25) {
    const res = http.get(`${BASE}/api/health`, { tags: { endpoint: 'health' } });
    check(res, { 'health 200': (x) => x.status === 200 });
  } else if (r < 0.55) {
    const res = http.get(`${BASE}/api/public/products?limit=24`, { tags: { endpoint: 'catalog' } });
    check(res, { 'catalog 200': (x) => x.status === 200 });
  } else if (r < 0.8) {
    const res = http.get(`${BASE}/api/sellers/search?city=Nairobi`, { tags: { endpoint: 'search' } });
    check(res, { 'search ok': (x) => x.status >= 200 && x.status < 400 });
  } else if (ORDER_NUMBER) {
    const res = http.get(`${BASE}/api/public/orders/${ORDER_NUMBER}/status`, { tags: { endpoint: 'poll' } });
    check(res, { 'poll ok': (x) => x.status >= 200 && x.status < 300 });
  } else {
    const res = http.get(`${BASE}/api/health`, { tags: { endpoint: 'health' } });
    check(res, { 'health 200': (x) => x.status === 200 });
  }
}
