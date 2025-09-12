import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Base URL for the application
  const base = '/';
  
  // Determine if we're building for production
  const isProduction = mode === 'production';
  
  return {
    base,
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV || 'production'),
    },
    server: {
      host: '::',
      port: 3000,
      strictPort: true,
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
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      cssMinify: isProduction,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            vendor: ['@tanstack/react-query'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    preview: {
      port: 3000,
      strictPort: true,
    },
  };
});
