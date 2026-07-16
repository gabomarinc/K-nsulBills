import React from 'react';
import ReactDOM from 'react-dom/client';
import { KindeProvider } from "@kinde-oss/kinde-auth-react";
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <KindeProvider
      clientId={(import.meta as any).env.VITE_KINDE_CLIENT_ID}
      domain={(import.meta as any).env.VITE_KINDE_DOMAIN}
      redirectUri={window.location.origin}
      logoutUri={window.location.origin}
    >
      <App />
    </KindeProvider>
  </React.StrictMode>
);