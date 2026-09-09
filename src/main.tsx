import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { extensionTransport } from "./domain/extension";
import { useDirectTesco } from "./domain/retailerClient";
import "./ui/styles.css";

// Decided once, before anything renders. Inside the extension the app calls
// Tesco itself; anywhere else it asks the local server, exactly as before.
useDirectTesco(extensionTransport());

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
