/**
 * Why: Bootstrap the React application within the Vite-managed root element.
 * What: Imports global styles and renders the App component using concurrent-safe createRoot.
 * How: Resolves the mount node, applies a runtime guard, and attaches the component tree.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/root.css';
import './styles/themes.css';
import './styles/hacker-theme.css';
import './styles/chat-theme.css';
import './styles/shell-layout.css';
import { ThemeProvider } from './theme/ThemeProvider';

const mountNode = document.getElementById('root');

if (!mountNode) {
  throw new Error('Failed to find root element for BITcore UI bootstrap.');
}

const root = createRoot(mountNode);

root.render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
