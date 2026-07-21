'use client';

import Link from 'next/link';
import { useTrail, animated, useSpring, config } from 'react-spring';
import { cn } from '../../utils/cn';

/**
 * ContactView Component
 * Contact page with info cards and form
 * Following Clean Architecture - UI only, no business logic
 */
export function ContactView() {
  const heroSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(30px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: config.gentle,
  });

  const cardsTrail = useTrail(CONTACT_INFO.length, {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    delay: 300,
    config: config.stiff,
  });

  const formSpring = useSpring({
    from: { opacity: 0, transform: 'translateX(30px)' },
    to: { opacity: 1, transform: 'translateX(0px)' },
    delay: 500,
    config: config.gentle,
  });

  return (
    <div className="contact-page">
      {/* Hero Section - Full Width */}
      <animated.section 
        className={cn(
          "legal-hero relative pt-32 pb-20 md:pt-48 md:pb-36 overflow-hidden"
        )}
        style={{
          ...heroSpring,
          background: 'linear-gradient(135deg, var(--color-background) 0%, var(--header-bg) 50%, var(--color-background) 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-500 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-500 blur-[120px]" />
        </div>

        <div className="about-container relative z-10">
          <h1 className="legal-title text-gradient">ติดต่อเรา</h1>
          <p className="legal-updated">พร้อมให้บริการและตอบทุกคำถามเกี่ยวกับระบบแชทรวมทุกช่องทาง</p>
        </div>
      </animated.section>

      {/* Contained Content Sections */}
      <div className="about-container">
        <div className="contact-grid">
          {/* Contact Info Cards */}
          <div className="contact-info">
            {cardsTrail.map((style, index) => {
              const info = CONTACT_INFO[index];
              return (
                <animated.div key={info.title} style={style} className="contact-card">
                  <span className="contact-icon">{info.icon}</span>
                  <h3>{info.title}</h3>
                  {info.isLink ? (
                    <a
                      href={`mailto:${info.content}`}
                      className="text-emerald-500 hover:underline font-medium block mb-1"
                    >
                      {info.content}
                    </a>
                  ) : (
                    <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">{info.content}</p>
                  )}
                  <p className="text-sm opacity-70">{info.subtitle}</p>
                </animated.div>
              );
            })}
          </div>

          {/* Contact Form */}
          <animated.div style={formSpring} className="contact-form-container">
            <h2>ส่งข้อความถึงเรา</h2>
            <form className="contact-form">
              <div className="form-group">
                <label>ชื่อ-นามสกุล</label>
                <input type="text" placeholder="กรอกชื่อของคุณ" className="form-input" />
              </div>
              <div className="form-group">
                <div className="grid grid-cols-2 gap-4">
                  <div className="w-full">
                    <label>อีเมล</label>
                    <input type="email" placeholder="email@example.com" className="form-input" />
                  </div>
                  <div className="w-full">
                    <label>เบอร์โทรศัพท์</label>
                    <input type="tel" placeholder="0xx-xxx-xxxx" className="form-input" />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>ข้อความ</label>
                <textarea placeholder="กรอกข้อความของคุณ..." className="form-input" rows={4} />
              </div>
              <button type="submit" className="app-btn app-btn-primary w-full justify-center py-4 rounded-xl text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-shadow">
                📨 ส่งข้อความ
              </button>
            </form>
          </animated.div>
        </div>

        <div className="legal-back py-16 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-semibold hover:gap-3">
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Content Data
// ============================================

const CONTACT_INFO = [
  {
    icon: '📞',
    title: 'โทรศัพท์',
    content: '089-484-7773',
    subtitle: 'จันทร์-ศุกร์ 9:00-18:00',
  },
  {
    icon: '📧',
    title: 'อีเมล',
    content: 'marosdee.fuzana@gmail.com',
    isLink: true,
    subtitle: 'ตอบกลับภายใน 24 ชม.',
  },
  {
    icon: '💬',
    title: 'LINE',
    content: '@marosdee7',
    subtitle: 'แชทตอบเร็วที่สุด',
  },
  {
    icon: '📍',
    title: 'สำนักงาน',
    content: 'CleanCode 1986 Co., Ltd.',
    subtitle: 'นราธิวาส 96000',
  },
];
