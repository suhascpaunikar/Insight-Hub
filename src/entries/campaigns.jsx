import { createRoot } from 'react-dom/client';
import { Shell } from '../app/Shell.jsx';
import { Campaigns } from '../pages/Campaigns.jsx';
import '../styles/app.css';

createRoot(document.getElementById('app')).render(
  <Shell active="campaigns">
    <Campaigns />
  </Shell>,
);
