import { createRoot } from 'react-dom/client';
import { Shell } from '../app/Shell.jsx';
import { Builder } from '../pages/Builder.jsx';
import '../styles/app.css';

createRoot(document.getElementById('app')).render(
  <Shell active="campaigns" collapseKey="builderNavCollapsed">
    <Builder />
  </Shell>,
);
