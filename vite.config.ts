/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 相對路徑：可部署到子路徑、靜態主機或 Claude Artifact
  base: './',
  // Artifact 部署：單一腳本（不拆分塊），由 artifact-bundle 內嵌進頁面
  build: process.env.VITE_SINGLE_BUNDLE ? { rolldownOptions: { output: { codeSplitting: false } } } : {},
  server: { port: 5188, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
