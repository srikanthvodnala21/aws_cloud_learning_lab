import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ProgressProvider } from './store/progress';
import './styles/index.css';

// HashRouter keeps all routing client-side (#/vpc …) so GitHub Pages never
// has to resolve deep links – refreshing any page cannot produce a 404.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </HashRouter>
  </StrictMode>,
);
