import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Determine if we're building for production
  const isProduction = mode === 'production';
  
  // Base URL for the application
  const base = isProduction ? 'https://bybloshq.space/' : '/';
  
  return {
    base,
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV || 'production'),
    },
    server: {
      host: '::',
      port: 3000,
      strictPort: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        '/sitemap.xml': 'Content-Type: application/xml',
      },
      proxy: {
        '^/api': {
          target: env.VITE_API_URL || 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isProduction ? false : 'inline',
      minify: isProduction ? 'esbuild' : false,
      cssMinify: isProduction,
      copyPublicDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            vendor: ['@tanstack/react-query', 'lodash', 'date-fns', 'axios'],
          },
        },
      },
    },
    preview: {
      port: 3000,
      strictPort: true,
    },
  };
});
