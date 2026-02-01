// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { componentTagger } from "file:///home/project/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProduction = mode === "production";
  const base = "/";
  return {
    base,
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV || "production"),
      "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development")
    },
    plugins: [
      react(),
      mode === "development" && componentTagger()
    ].filter(Boolean),
    server: {
      host: "::",
      port: 3e3,
      strictPort: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
      },
      proxy: {
        "^/api": {
          target: env.VITE_API_URL || "http://localhost:3002",
          changeOrigin: true,
          secure: false,
          rewrite: (path2) => path2.replace(/^\/api/, "/api"),
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.error("Proxy error:", err);
            });
            proxy.on("proxyReq", (proxyReq, req, _res) => {
              console.log("Sending Request to the Target:", {
                method: req.method,
                url: req.url,
                headers: req.headers
              });
            });
          }
        }
      },
      // Enable serving static files from public directory
      fs: {
        strict: false
      },
      // Custom middleware for handling static files with proper content types
      configureServer(server) {
        return () => {
          server.middlewares.use((req, res, next) => {
            if (req.url?.endsWith(".xml")) {
              res.setHeader("Content-Type", "application/xml");
            } else if (req.url?.endsWith(".txt")) {
              res.setHeader("Content-Type", "text/plain");
            }
            next();
          });
        };
      }
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: isProduction ? false : "inline",
      minify: isProduction ? "esbuild" : false,
      cssMinify: isProduction,
      esbuild: {
        drop: isProduction ? ["console", "debugger"] : []
      },
      copyPublicDir: true,
      chunkSizeWarningLimit: 1600,
      // Ensure static files are copied with proper content types
      assetsInlineLimit: 0,
      // Don't inline any assets to ensure proper content types
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "ui-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-slot", "@radix-ui/react-toast", "lucide-react", "class-variance-authority", "clsx", "tailwind-merge"],
            "utils-vendor": ["lodash", "date-fns", "axios", "@tanstack/react-query"],
            "charts-vendor": ["recharts", "chart.js", "react-chartjs-2"]
          }
        }
      }
    },
    preview: {
      port: 3e3,
      strictPort: true
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYsIHR5cGUgVml0ZURldlNlcnZlciB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0LXN3Yyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gJ2xvdmFibGUtdGFnZ2VyJztcbmltcG9ydCB0eXBlIHsgSW5jb21pbmdNZXNzYWdlLCBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ2h0dHAnO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IGNvbW1hbmQsIG1vZGUgfSkgPT4ge1xuICAvLyBMb2FkIGVudiBmaWxlIGJhc2VkIG9uIGBtb2RlYCBpbiB0aGUgY3VycmVudCBkaXJlY3RvcnkuXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xuXG4gIC8vIERldGVybWluZSBpZiB3ZSdyZSBidWlsZGluZyBmb3IgcHJvZHVjdGlvblxuICBjb25zdCBpc1Byb2R1Y3Rpb24gPSBtb2RlID09PSAncHJvZHVjdGlvbic7XG5cbiAgLy8gQmFzZSBVUkwgZm9yIHRoZSBhcHBsaWNhdGlvbiAtIGFsd2F5cyB1c2UgcmVsYXRpdmUgcGF0aHMgdG8gYXZvaWQgQ09SU1xuICBjb25zdCBiYXNlID0gJy8nO1xuXG4gIHJldHVybiB7XG4gICAgYmFzZSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIF9fQVBQX0VOVl9fOiBKU09OLnN0cmluZ2lmeShlbnYuQVBQX0VOViB8fCAncHJvZHVjdGlvbicpLFxuICAgICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkoaXNQcm9kdWN0aW9uID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyksXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgbW9kZSA9PT0gJ2RldmVsb3BtZW50JyAmJiBjb21wb25lbnRUYWdnZXIoKSxcbiAgICBdLmZpbHRlcihCb29sZWFuKSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6ICc6OicsXG4gICAgICBwb3J0OiAzMDAwLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULCBQT1NULCBQVVQsIERFTEVURSwgUEFUQ0gsIE9QVElPTlMnLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24nLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHMnOiAndHJ1ZScsXG4gICAgICB9LFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJ14vYXBpJzoge1xuICAgICAgICAgIHRhcmdldDogZW52LlZJVEVfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDozMDAyJyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgJy9hcGknKSxcbiAgICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUHJveHkgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgUmVxdWVzdCB0byB0aGUgVGFyZ2V0OicsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IHJlcS5tZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiByZXEudXJsLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHJlcS5oZWFkZXJzLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAvLyBFbmFibGUgc2VydmluZyBzdGF0aWMgZmlsZXMgZnJvbSBwdWJsaWMgZGlyZWN0b3J5XG4gICAgICBmczoge1xuICAgICAgICBzdHJpY3Q6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIC8vIEN1c3RvbSBtaWRkbGV3YXJlIGZvciBoYW5kbGluZyBzdGF0aWMgZmlsZXMgd2l0aCBwcm9wZXIgY29udGVudCB0eXBlc1xuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcjogVml0ZURldlNlcnZlcikge1xuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcTogSW5jb21pbmdNZXNzYWdlLCByZXM6IFNlcnZlclJlc3BvbnNlLCBuZXh0OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgICAgICAgICAvLyBTZXQgY29udGVudCB0eXBlIGZvciBzaXRlbWFwLnhtbFxuICAgICAgICAgICAgaWYgKHJlcS51cmw/LmVuZHNXaXRoKCcueG1sJykpIHtcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3htbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gU2V0IGNvbnRlbnQgdHlwZSBmb3Igb3RoZXIgc3RhdGljIGZpbGVzIGlmIG5lZWRlZFxuICAgICAgICAgICAgZWxzZSBpZiAocmVxLnVybD8uZW5kc1dpdGgoJy50eHQnKSkge1xuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9wbGFpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxuICAgICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcbiAgICAgIHNvdXJjZW1hcDogaXNQcm9kdWN0aW9uID8gZmFsc2UgOiAnaW5saW5lJyxcbiAgICAgIG1pbmlmeTogaXNQcm9kdWN0aW9uID8gJ2VzYnVpbGQnIDogZmFsc2UsXG4gICAgICBjc3NNaW5pZnk6IGlzUHJvZHVjdGlvbixcbiAgICAgIGVzYnVpbGQ6IHtcbiAgICAgICAgZHJvcDogaXNQcm9kdWN0aW9uID8gWydjb25zb2xlJywgJ2RlYnVnZ2VyJ10gOiBbXSxcbiAgICAgIH0sXG4gICAgICBjb3B5UHVibGljRGlyOiB0cnVlLFxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNjAwLFxuICAgICAgLy8gRW5zdXJlIHN0YXRpYyBmaWxlcyBhcmUgY29waWVkIHdpdGggcHJvcGVyIGNvbnRlbnQgdHlwZXNcbiAgICAgIGFzc2V0c0lubGluZUxpbWl0OiAwLCAvLyBEb24ndCBpbmxpbmUgYW55IGFzc2V0cyB0byBlbnN1cmUgcHJvcGVyIGNvbnRlbnQgdHlwZXNcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgICAgJ3VpLXZlbmRvcic6IFsnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsICdAcmFkaXgtdWkvcmVhY3Qtc2xvdCcsICdAcmFkaXgtdWkvcmVhY3QtdG9hc3QnLCAnbHVjaWRlLXJlYWN0JywgJ2NsYXNzLXZhcmlhbmNlLWF1dGhvcml0eScsICdjbHN4JywgJ3RhaWx3aW5kLW1lcmdlJ10sXG4gICAgICAgICAgICAndXRpbHMtdmVuZG9yJzogWydsb2Rhc2gnLCAnZGF0ZS1mbnMnLCAnYXhpb3MnLCAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXG4gICAgICAgICAgICAnY2hhcnRzLXZlbmRvcic6IFsncmVjaGFydHMnLCAnY2hhcnQuanMnLCAncmVhY3QtY2hhcnRqcy0yJ10sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwcmV2aWV3OiB7XG4gICAgICBwb3J0OiAzMDAwLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsY0FBYyxlQUFtQztBQUNuUixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBSGhDLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsU0FBUyxLQUFLLE1BQU07QUFFakQsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxF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
