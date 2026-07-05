import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Note: no StrictMode — react-force-graph-2d misbehaves under the dev-only
// double-mount (canvas gets detached, blanking the view).
createRoot(document.getElementById("root")!).render(<App />);
