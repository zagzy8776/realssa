import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { app } from "./lib/firebase";

// Register service worker for Firebase Cloud Messaging
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

// Initialize Firebase (automatically initialized when imported)
console.log('Firebase initialized:', app.name);

createRoot(document.getElementById("root")!).render(<App />);
