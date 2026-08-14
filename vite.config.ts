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
  // Expõe para o cliente (import.meta.env) as variáveis com esses prefixos,
  // além do padrão VITE_. Necessário porque as chaves (Supabase, Gemini,
  // OpenAI) usadas no navegador vêm com prefixos JUNOS_/TRADESTUDIO_/TOKEN_.
  envPrefix: ['VITE_', 'JUNOS_', 'TRADESTUDIO_', 'TOKEN_'],
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
      // Em dev puro (vite), encaminha as chamadas /api/* para as funções
      // serverless rodando via `vercel dev` (ver script "dev:api").
      '/api': 'http://localhost:3001',
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
