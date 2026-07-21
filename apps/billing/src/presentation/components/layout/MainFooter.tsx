import dayjs from 'dayjs';
import Link from 'next/link';

/**
 * MainFooter Component
 * Mobile-friendly footer with stacked layout
 */
export function MainFooter() {
  const currentYear = dayjs().year();

  return (
    <footer className="app-footer">
      <div className="app-footer-container">
        {/* Brand */}
        <div className="app-footer-brand">
          <span className="app-footer-logo">💬 OmniChat</span>
          <span className="app-footer-copyright">
            © {currentYear} Omni-Channel Chat Platform
          </span>
        </div>

        {/* Links */}
        <nav className="app-footer-nav">
          <Link href="/privacy" className="app-footer-link">
            นโยบาย
          </Link>
          <Link href="/terms" className="app-footer-link">
            ข้อกำหนด
          </Link>
          <Link href="/contact" className="app-footer-link">
            ติดต่อ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
