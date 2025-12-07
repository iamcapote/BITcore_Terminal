/**
 * @license INTERNAL ONLY — Nova bootstrap
 *
 * Why: Hydrate the Nova shell in the browser when the Vite bundle loads.
 * What: Creates the React root, applies global styles, and renders the app tree.
 * How: Locate the root element, guard its presence, and mount the App component via React 18 createRoot.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Nova root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

