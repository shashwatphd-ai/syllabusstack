import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorTracking } from "./lib/error-tracking";

// Initialize error tracking (Sentry in production)
initErrorTracking().catch(console.error);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
