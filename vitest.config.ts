import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Many tests forge whole blades. A shared CI machine runs them about half as fast as a laptop,
    // so the usual 5 seconds is too close for the heavier ones.
    testTimeout: 20_000,
  },
})
