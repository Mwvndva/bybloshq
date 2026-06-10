// vite.config.ts
import { defineConfig, loadEnv } from "file:///D:/Projects/ByblosHQ/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Projects/ByblosHQ/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "node:path";
import { componentTagger } from "file:///D:/Projects/ByblosHQ/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "D:\\Projects\\ByblosHQ";
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
    },
    test: {
      include: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.integration.test.{ts,tsx}"],
      exclude: ["node_modules/**", "dist/**", "server/**", "e2e/**"],
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      globals: false
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxCeWJsb3NIUVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcQnlibG9zSFFcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L1Byb2plY3RzL0J5Ymxvc0hRL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52LCB0eXBlIFZpdGVEZXZTZXJ2ZXIgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0LXN3Yyc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gJ2xvdmFibGUtdGFnZ2VyJztcclxuaW1wb3J0IHR5cGUgeyBJbmNvbWluZ01lc3NhZ2UsIFNlcnZlclJlc3BvbnNlIH0gZnJvbSAnaHR0cCc7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgY29tbWFuZCwgbW9kZSB9KSA9PiB7XHJcbiAgLy8gTG9hZCBlbnYgZmlsZSBiYXNlZCBvbiBgbW9kZWAgaW4gdGhlIGN1cnJlbnQgZGlyZWN0b3J5LlxyXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xyXG5cclxuICAvLyBEZXRlcm1pbmUgaWYgd2UncmUgYnVpbGRpbmcgZm9yIHByb2R1Y3Rpb25cclxuICBjb25zdCBpc1Byb2R1Y3Rpb24gPSBtb2RlID09PSAncHJvZHVjdGlvbic7XHJcblxyXG4gIC8vIEJhc2UgVVJMIGZvciB0aGUgYXBwbGljYXRpb24gLSBhbHdheXMgdXNlIHJlbGF0aXZlIHBhdGhzIHRvIGF2b2lkIENPUlNcclxuICBjb25zdCBiYXNlID0gJy8nO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgYmFzZSxcclxuICAgIGRlZmluZToge1xyXG4gICAgICBfX0FQUF9FTlZfXzogSlNPTi5zdHJpbmdpZnkoZW52LkFQUF9FTlYgfHwgJ3Byb2R1Y3Rpb24nKSxcclxuICAgICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkoaXNQcm9kdWN0aW9uID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyksXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICByZWFjdCgpLFxyXG4gICAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gICAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgaG9zdDogJzo6JyxcclxuICAgICAgcG9ydDogMzAwMCxcclxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULCBQT1NULCBQVVQsIERFTEVURSwgUEFUQ0gsIE9QVElPTlMnLFxyXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvbicsXHJcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUNyZWRlbnRpYWxzJzogJ3RydWUnLFxyXG4gICAgICB9LFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgICdeL2FwaSc6IHtcclxuICAgICAgICAgIHRhcmdldDogZW52LlZJVEVfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDozMDAyJyxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgJy9hcGknKSxcclxuICAgICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBfb3B0aW9ucykgPT4ge1xyXG4gICAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCBfcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignUHJveHkgZXJyb3I6JywgZXJyKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgUmVxdWVzdCB0byB0aGUgVGFyZ2V0OicsIHtcclxuICAgICAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcclxuICAgICAgICAgICAgICAgIHVybDogcmVxLnVybCxcclxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHJlcS5oZWFkZXJzLFxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICAvLyBFbmFibGUgc2VydmluZyBzdGF0aWMgZmlsZXMgZnJvbSBwdWJsaWMgZGlyZWN0b3J5XHJcbiAgICAgIGZzOiB7XHJcbiAgICAgICAgc3RyaWN0OiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgLy8gQ3VzdG9tIG1pZGRsZXdhcmUgZm9yIGhhbmRsaW5nIHN0YXRpYyBmaWxlcyB3aXRoIHByb3BlciBjb250ZW50IHR5cGVzXHJcbiAgICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIpIHtcclxuICAgICAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxOiBJbmNvbWluZ01lc3NhZ2UsIHJlczogU2VydmVyUmVzcG9uc2UsIG5leHQ6ICgpID0+IHZvaWQpID0+IHtcclxuICAgICAgICAgICAgLy8gU2V0IGNvbnRlbnQgdHlwZSBmb3Igc2l0ZW1hcC54bWxcclxuICAgICAgICAgICAgaWYgKHJlcS51cmw/LmVuZHNXaXRoKCcueG1sJykpIHtcclxuICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veG1sJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gU2V0IGNvbnRlbnQgdHlwZSBmb3Igb3RoZXIgc3RhdGljIGZpbGVzIGlmIG5lZWRlZFxyXG4gICAgICAgICAgICBlbHNlIGlmIChyZXEudXJsPy5lbmRzV2l0aCgnLnR4dCcpKSB7XHJcbiAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvcGxhaW4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuZXh0KCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxyXG4gICAgICBzb3VyY2VtYXA6IGlzUHJvZHVjdGlvbiA/IGZhbHNlIDogJ2lubGluZScsXHJcbiAgICAgIG1pbmlmeTogaXNQcm9kdWN0aW9uID8gJ2VzYnVpbGQnIDogZmFsc2UsXHJcbiAgICAgIGNzc01pbmlmeTogaXNQcm9kdWN0aW9uLFxyXG4gICAgICBlc2J1aWxkOiB7XHJcbiAgICAgICAgZHJvcDogaXNQcm9kdWN0aW9uID8gWydjb25zb2xlJywgJ2RlYnVnZ2VyJ10gOiBbXSxcclxuICAgICAgfSxcclxuICAgICAgY29weVB1YmxpY0RpcjogdHJ1ZSxcclxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNjAwLFxyXG4gICAgICAvLyBFbnN1cmUgc3RhdGljIGZpbGVzIGFyZSBjb3BpZWQgd2l0aCBwcm9wZXIgY29udGVudCB0eXBlc1xyXG4gICAgICBhc3NldHNJbmxpbmVMaW1pdDogMCwgLy8gRG9uJ3QgaW5saW5lIGFueSBhc3NldHMgdG8gZW5zdXJlIHByb3BlciBjb250ZW50IHR5cGVzXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgICAndWktdmVuZG9yJzogWydAcmFkaXgtdWkvcmVhY3QtZGlhbG9nJywgJ0ByYWRpeC11aS9yZWFjdC1zbG90JywgJ0ByYWRpeC11aS9yZWFjdC10b2FzdCcsICdsdWNpZGUtcmVhY3QnLCAnY2xhc3MtdmFyaWFuY2UtYXV0aG9yaXR5JywgJ2Nsc3gnLCAndGFpbHdpbmQtbWVyZ2UnXSxcclxuICAgICAgICAgICAgJ3V0aWxzLXZlbmRvcic6IFsnbG9kYXNoJywgJ2RhdGUtZm5zJywgJ2F4aW9zJywgJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxyXG4gICAgICAgICAgICAnY2hhcnRzLXZlbmRvcic6IFsncmVjaGFydHMnLCAnY2hhcnQuanMnLCAncmVhY3QtY2hhcnRqcy0yJ10sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcHJldmlldzoge1xyXG4gICAgICBwb3J0OiAzMDAwLFxyXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgfSxcclxuICAgIHRlc3Q6IHtcclxuICAgICAgaW5jbHVkZTogWydzcmMvKiovKi57dGVzdCxzcGVjfS57dHMsdHN4fScsICdzcmMvKiovKi5pbnRlZ3JhdGlvbi50ZXN0Lnt0cyx0c3h9J10sXHJcbiAgICAgIGV4Y2x1ZGU6IFsnbm9kZV9tb2R1bGVzLyoqJywgJ2Rpc3QvKionLCAnc2VydmVyLyoqJywgJ2UyZS8qKiddLFxyXG4gICAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcclxuICAgICAgc2V0dXBGaWxlczogWycuL3ZpdGVzdC5zZXR1cC50cyddLFxyXG4gICAgICBnbG9iYWxzOiBmYWxzZSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1AsU0FBUyxjQUFjLGVBQW1DO0FBQzlTLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxTQUFTLEtBQUssTUFBTTtBQUVqRCxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFHM0MsUUFBTSxlQUFlLFNBQVM7QUFHOUIsUUFBTSxPQUFPO0FBRWIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLGFBQWEsS0FBSyxVQUFVLElBQUksV0FBVyxZQUFZO0FBQUEsTUFDdkQsd0JBQXdCLEtBQUssVUFBVSxlQUFlLGVBQWUsYUFBYTtBQUFBLElBQ3BGO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixTQUFTLGlCQUFpQixnQkFBZ0I7QUFBQSxJQUM1QyxFQUFFLE9BQU8sT0FBTztBQUFBLElBQ2hCLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLFNBQVM7QUFBQSxRQUNQLCtC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
