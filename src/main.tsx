import { StrictMode, Profiler } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
const shouldProfile = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('profile');

async function renderApp() {
  if (shouldProfile) {
    const { default: profCallback } = await import('./utils/profilerCallback');
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <Profiler id="App" onRender={profCallback}>
          <App />
        </Profiler>
      </StrictMode>
    );
  } else {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}

renderApp();
