import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fixturesHandler from "./api/fixtures.js";
import liveHandler from "./api/live.js";
import readinessHandler from "./api/readiness.js";
import scoreValidationHandler from "./api/score-validation.js";
import activateHandler from "./api/activate.js";
import activationMessageHandler from "./api/activation-message.js";
import bentoEstimateHandler from "./api/bento-estimate.js";
import bentoExchangeHandler from "./api/bento-exchange.js";
import bentoLinkHandler from "./api/bento-link.js";
import bentoLoginHandler from "./api/bento-login.js";
import bentoMarketHandler from "./api/bento-market.js";
import bentoMarketsHandler from "./api/bento-markets.js";
import bentoPlaceBetHandler from "./api/bento-place-bet.js";
import bentoPortfolioHandler from "./api/bento-portfolio.js";
import bentoReadinessHandler from "./api/bento-readiness.js";
import usersHandler from "./api/users.js";

const apiHandlers = {
  "/api/activate": activateHandler,
  "/api/activation-message": activationMessageHandler,
  "/api/bento-estimate": bentoEstimateHandler,
  "/api/bento-exchange": bentoExchangeHandler,
  "/api/bento-link": bentoLinkHandler,
  "/api/bento-login": bentoLoginHandler,
  "/api/bento-market": bentoMarketHandler,
  "/api/bento-markets": bentoMarketsHandler,
  "/api/bento-place-bet": bentoPlaceBetHandler,
  "/api/bento-portfolio": bentoPortfolioHandler,
  "/api/bento-readiness": bentoReadinessHandler,
  "/api/fixtures": fixturesHandler,
  "/api/live": liveHandler,
  "/api/readiness": readinessHandler,
  "/api/score-validation": scoreValidationHandler,
  "/api/users": usersHandler,
};

function localApiPlugin() {
  return {
    name: "haramball-local-api",
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
