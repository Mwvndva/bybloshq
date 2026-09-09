// Global Vitest setup, loaded once before every test file (see the `test.setupFiles`
// entry in vite.config.ts). This file was referenced by that config but never
// actually existed, which meant `npm run test` / `npm run test:coverage`
// could never run a single test in this project — every run failed at
// startup with "Cannot find module .../vitest.setup.ts" before collecting
// any tests.
import '@testing-library/jest-dom/vitest';
