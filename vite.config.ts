import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    // Required for temporary public previews such as Cloudflare Quick Tunnels.
    allowedHosts: true,
  },
})
