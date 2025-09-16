import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import type { IncomingMessage, ServerResponse } from 'http';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Determine if we're building for production
  const isProduction = mode === 'production';
  
  // Base URL for the application - always use relative paths to avoid CORS
  const base = '/';
  
  return {
    base,
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV || 'production'),
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    server: {
      host: '::',
      port: 3000,
      strictPort: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      proxy: {
        '^/api': {
          target: env.VITE_API_URL || 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
      // Enable serving static files from public directory
      fs: {
        strict: false,
      },
      // Custom middleware for handling static files with proper content types
      configureServer(server: ViteDevServer) {
        return () => {
          server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
            // Set content type for sitemap.xml
            if (req.url?.endsWith('.xml')) {
              res.setHeader('Content-Type', 'application/xml');
            }
            // Set content type for other static files if needed
            else if (req.url?.endsWith('.txt')) {
              res.setHeader('Content-Type', 'text/plain');
            }
            next();
          });
        };
      },
    },
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
      // Ensure static files are copied with proper content types
      assetsInlineLimit: 0, // Don't inline any assets to ensure proper content types
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
