import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toasty } from '@cloudflare/kumo';
import { Home } from './Home';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The undo on a deleted campaign is a toast action, so the whole page
        lives inside Kumo's toast viewport. */}
    <Toasty>
      <Home />
    </Toasty>
  </StrictMode>,
);
