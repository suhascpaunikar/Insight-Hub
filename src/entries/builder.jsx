/* The wizard brings its own chrome — WizardShell, not Shell: it keeps the
   console rail but replaces the bar, the strip and the footer (§9.3). */
import { createRoot } from 'react-dom/client';
import { Builder } from '../pages/Builder.jsx';
import '../styles/app.css';

createRoot(document.getElementById('app')).render(<Builder />);
