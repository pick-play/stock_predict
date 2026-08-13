import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { preconnectApiOrigins } from "./lib/preconnect";
import { registerServiceWorker } from "./lib/pwa/registerServiceWorker";

// Before the first render, so the handshake overlaps bundle evaluation.
preconnectApiOrigins();

// After load, so registration never competes with the first paint.
registerServiceWorker();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
