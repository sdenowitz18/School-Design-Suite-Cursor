import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

declare const __BUILD_TIME__: string;

console.log(
  "%c[School Design Suite]%c Built: " + __BUILD_TIME__,
  "background:#3b82f6;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold",
  "color:#6b7280",
);

createRoot(document.getElementById("root")!).render(<App />);
