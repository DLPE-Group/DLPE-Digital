import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './themes.jsx';
import { LangProvider } from './i18n.jsx';
import App from './App.jsx';

import './styles/styles.css';
import './styles/styles_app_v1.css';
import './styles/styles_board.css';
import './styles/themes.css';
import './styles/dashboard.css';
import './styles/reports.css';
import './styles/nango.css';
import './styles/admin.css';

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <LangProvider>
      <App />
    </LangProvider>
  </ThemeProvider>
);
