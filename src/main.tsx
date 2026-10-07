import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { onHostConfig } from './sdk/mnemo-sdk';

// Inherit the host shell's look: the OS broadcasts its theme and live design
// tokens on load and on every change, so the styles can use var(--accent),
// var(--bg-panel), var(--text-primary)… and follow the user's theme.
onHostConfig();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
