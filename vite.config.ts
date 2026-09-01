import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  base: process.env.GH_PAGES ? '/vendlocate/' : '/',
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/google-places': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/find-emails': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/overture-search': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/find-website': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/fetch-page': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/overpass': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/stripe-config': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/create-payment-intent': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
      '/api/confirm-purchase': {
        target: 'https://vendlocate-master.vercel.app',
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
