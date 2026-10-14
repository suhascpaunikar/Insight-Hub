import { createRoot } from 'react-dom/client';
import { Shell } from '../app/Shell.jsx';
import { Settings } from '../pages/Settings.jsx';
import '../styles/app.css';

createRoot(document.getElementById('app')).render(
  <Shell active="settings">
    <Settings />
  </Shell>,
);
