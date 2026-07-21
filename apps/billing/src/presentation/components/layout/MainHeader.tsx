'use client';

/**
 * MainHeader Component
 * Redesigned with fixed positioning and glassmorphism background
 * Preserving emerald/gold theme and emoji iconography
 */

import { animated, config, useSpring } from '@react-spring/web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '../common/ThemeToggle';
import { cn } from '../../utils/cn';

export function MainHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect for glassmorphism
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Menu animation
  const menuSpring = useSpring({
    opacity: mobileMenuOpen ? 1 : 0,
    transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-10px)',
    config: { tension: 300, friction: 25 },
  });

  // Helper to check active link
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const navLinks = [
    { href: '/', label: 'หน้าแรก', icon: '🏠' },
    { href: '/builder', label: 'ดูราคา', icon: '🛠️' },
    { href: '/about', label: 'เกี่ยวกับเรา', icon: 'ℹ️' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      {/* Blurring background layer */}
      <div 
        className={cn(
          "absolute inset-0 transition-all duration-300",
          isScrolled 
            ? "bg-white/70 dark:bg-background/70 backdrop-blur-xl border-b border-border shadow-md" 
            : "bg-transparent border-b border-transparent"
        )} 
      />

      <div className="relative app-header-container h-20 sm:h-22">
        {/* Logo */}
        <Link href="/" className="app-logo group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="app-logo-icon relative bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">💬</span>
          </div>
          <span className="app-logo-text bg-gradient-to-r from-primary to-accent bg-clip-text group-hover:text-transparent transition-all duration-300">
            OmniChat
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="app-nav hidden lg:flex items-center gap-1">
          {navLinks.map((link, index) => (
            <NavLink 
              key={link.href}
              href={link.href}
              index={index}
              isActive={isActive(link.href)}
            >
              <span className="app-nav-icon mr-2">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="app-header-actions">
          <ThemeToggle />
          <Link
            href="/contact"
            className="hidden lg:flex px-6 py-2.5 rounded-full bg-primary text-white font-bold
              hover:bg-primary-dark transition-all duration-300 shadow-lg shadow-primary/20
              scale-100 hover:scale-105 active:scale-95"
          >
            ขอเดโม
          </Link>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-11 h-11 rounded-xl flex items-center justify-center 
              hover:bg-surface-alt transition-all duration-200 text-foreground text-xl"
            aria-label="Menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <animated.div 
          style={menuSpring}
          className="lg:hidden absolute top-full left-0 right-0 mx-4 mt-2 overflow-hidden
            bg-surface/90 dark:bg-background/90 backdrop-blur-2xl rounded-3xl
            border border-border/50 shadow-2xl z-40 p-4 space-y-2"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-5 py-4 rounded-2xl text-base font-bold transition-all duration-200",
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface-alt hover:text-foreground"
              )}
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <Link
            href="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center py-4 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20"
          >
            ขอเดโม
          </Link>
        </animated.div>
      )}
    </header>
  );
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  index: number;
}

function NavLink({ href, children, isActive, index }: NavLinkProps) {
  const spring = useSpring({
    from: { opacity: 0, y: -10 },
    to: { opacity: 1, y: 0 },
    delay: index * 50,
    config: { tension: 200, friction: 20 },
  });

  return (
    <animated.div style={spring}>
      <Link
        href={href}
        className={cn(
          "flex items-center px-5 py-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 scale-100 hover:scale-105",
          isActive
            ? "text-primary bg-primary/5 shadow-sm"
            : "text-muted hover:text-foreground hover:bg-surface-alt"
        )}
      >
        {children}
      </Link>
    </animated.div>
  );
}
