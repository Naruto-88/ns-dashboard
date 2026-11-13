import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { ModalDialogProvider } from './contexts/ModalDialogContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ModalDialogProvider>
        <App />
      </ModalDialogProvider>
    </ThemeProvider>
  </StrictMode>,
);
