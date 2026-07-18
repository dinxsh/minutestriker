import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fixturesHandler from "./api/fixtures.js";
import liveHandler from "./api/live.js";
import readinessHandler from "./api/readiness.js";
import scoreValidationHandler from "./api/score-validation.js";

const apiHandlers = {
  "/api/fixtures": fixturesHandler,
  "/api/live": liveHandler,
  "/api/readiness": readinessHandler,
  "/api/score-validation": scoreValidationHandler,
};

function localApiPlugin() {
  return {
    name: "mineetes-local-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url, "http://localhost").pathname;
        const handler = apiHandlers[path];

        if (!path.startsWith("/api/")) {
          next();
          return;
        }

        if (!handler) {
          response.statusCode = 404;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: { message: "API route not found", statusCode: 404 } }));
          return;
        }

        try {
          await handler(request, response);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: { message: error.message, statusCode: 500 } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [localApiPlugin(), react()],
  };
});
