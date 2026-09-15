/* ==========================================================================
   SiteFooter.jsx — the end of the scrolled page (§5.7).
   ========================================================================== */
import { Link } from '@cloudflare/kumo';
import { toast } from '../lib/toast.js';

const FOOT_LINKS = ['Support', 'Docs', 'Status', 'Privacy'];

export function SiteFooter() {
  return (
    <footer className="ih-site-foot">
      <ul className="ih-site-foot-links">
        {FOOT_LINKS.map((label) => (
          <li key={label}>
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast(`${label} is not part of the prototype`,
                  'The control is here for the shape of the page.', 'info');
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <span className="ih-site-foot-copy">© 2026 InsightHub</span>
    </footer>
  );
}
