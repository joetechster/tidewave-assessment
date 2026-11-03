import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    trace: 'on',
    screenshot: 'on',
    ...devices['Desktop Chrome'],
    // Set PW_CHANNEL=chrome (or msedge) to use the browser already installed on your computer.
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [
    {
      name: 'storefront',
      testDir: path.resolve(__dirname, 'tests/storefront'),
      use: {
        baseURL: 'http://localhost:7080',
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'ops',
      testDir: path.resolve(__dirname, 'tests/ops'),
      use: {
        baseURL: 'http://localhost:7300',
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'api',
      testDir: path.resolve(__dirname, 'tests/api'),
      use: {
        baseURL: 'http://localhost:7080',
      },
    },
  ],
});

