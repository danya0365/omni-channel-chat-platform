'use client';

import { ReactNode } from 'react';
import { CrystalBubble } from '../common/CrystalBubble';
import { MainFooter } from './MainFooter';
import { MainHeader } from './MainHeader';

interface MainLayoutProps {
  children: ReactNode;
  showBubbles?: boolean;
}

/**
 * MainLayout Component
 * Full screen layout with Header, Footer, and scrollable main content
 */
export function MainLayout({ children, showBubbles = true }: MainLayoutProps) {
  return (
    <div className="app-layout">
      {/* Header */}
      <MainHeader />

      {/* Main Content - Scrollable */}
      <main className="app-content relative">
        {/* Crystal Bubble Background */}
        {showBubbles && <CrystalBubble count={10} />}
        
        {/* Content */}
        <div className="relative z-10 h-full">
          {children}
        </div>
      </main>

      {/* Footer */}
      <MainFooter />
    </div>
  );
}
