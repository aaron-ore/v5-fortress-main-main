import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

console.log("Dyad Test Log: main.tsx is running!"); // NEW: Added test log

createRoot(document.getElementById("root")!).render(<App />);