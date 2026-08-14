import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Logs habilitados temporariamente para depuração de login em produção
if (import.meta.env.PROD) {
  console.log('[SYSTEM] Rodando em modo produção');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);