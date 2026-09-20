import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const isHarmlessResizeObserverError = (message) =>
  typeof message === "string" &&
  message.includes("ResizeObserver loop completed with undelivered notifications");

window.addEventListener(
  "error",
  (event) => {
    if (isHarmlessResizeObserverError(event.message)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true,
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    if (isHarmlessResizeObserverError(event.reason)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true,
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
