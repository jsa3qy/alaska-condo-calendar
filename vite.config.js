import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base to repo name for GitHub Pages (e.g., '/alaska-condo-calendar/')
  // Change this to '/' if using a custom domain
  base: '/alaska-condo-calendar/',
})
