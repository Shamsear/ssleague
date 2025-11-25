import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || '',
      NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
