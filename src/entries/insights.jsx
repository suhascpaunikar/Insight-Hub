import { createRoot } from 'react-dom/client';
import { Shell } from '../app/Shell.jsx';
import { Insights } from '../pages/Insights.jsx';
import '../styles/app.css';

createRoot(document.getElementById('app')).render(
  <Shell active="insights">
    <Insights />
  </Shell>,
);
