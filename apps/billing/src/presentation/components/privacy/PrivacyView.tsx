'use client';

import Link from 'next/link';
import { animated, config, useSpring, useTrail } from 'react-spring';
import { cn } from '../../utils/cn';

/**
 * PrivacyView Component
 * Privacy policy content for OmniChat
 * Following Clean Architecture - UI only
 */
export function PrivacyView() {
  const heroSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(30px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: config.gentle,
  }); 

  const sectionsTrail = useTrail(PRIVACY_SECTIONS.length, {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    delay: 300,
    config: config.stiff,
  });

  return (
    <div className="legal-page">
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
          <h1 className="legal-title text-gradient">นโยบายความเป็นส่วนตัว</h1>
          <p className="legal-updated">อัปเดตล่าสุด: 1 มกราคม 2026</p>
        </div>
      </animated.section>

      {/* Contained Content Sections */}
      <div className="about-container mt-[-4rem] relative z-20">
        <div className="max-w-4xl mx-auto">
          {sectionsTrail.map((style, index) => {
            const section = PRIVACY_SECTIONS[index];
            return (
              <animated.section key={index} style={style} className="legal-section">
                <h2 className="text-xl font-bold text-emerald-500 mb-4">{section.title}</h2>
                {section.content && <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{section.content}</p>}
                {section.items && (
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-emerald-500 mt-1">✓</span>
                        <span className="text-gray-600 dark:text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.email && (
                  <p className="mt-4">
                    ติดต่อเราที่:{' '}
                    <a href={`mailto:${section.email}`} className="text-emerald-500 hover:underline font-medium">
                      {section.email}
                    </a>
                  </p>
                )}
              </animated.section>
            );
          })}

          <div className="legal-back py-12">
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-semibold">
              ← กลับหน้าแรก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Content Data
// ============================================

interface PrivacySection {
  title: string;
  content?: string;
  items?: string[];
  email?: string;
}

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. ข้อมูลที่เราเก็บรวบรวม',
    content: 'เราเก็บรวบรวมข้อมูลที่คุณให้ไว้โดยตรง เช่น:',
    items: [
      'ชื่อและข้อมูลติดต่อของบริษัท',
      'อีเมลและเบอร์โทรศัพท์',
      'ข้อมูลการใช้งานระบบแชท',
      'ข้อความและโปรไฟล์ลูกค้า (เข้ารหัส)',
    ],
  },
  {
    title: '2. การใช้ข้อมูล',
    content: 'เราใช้ข้อมูลของคุณเพื่อ:',
    items: [
      'ให้บริการและปรับปรุงระบบ OmniChat',
      'ติดต่อสื่อสารเกี่ยวกับบริการ',
      'วิเคราะห์และปรับปรุงประสิทธิภาพระบบ',
      'ส่งข้อมูลข่าวสารและโปรโมชั่น (หากได้รับอนุญาต)',
    ],
  },
  {
    title: '3. การปกป้องข้อมูล',
    content: 'เรามีมาตรการรักษาความปลอดภัยที่เข้มงวด รวมถึง:',
    items: [
      'การเข้ารหัส credential ของช่องทางด้วย AES-256-GCM',
      'การเข้ารหัสการเชื่อมต่อ SSL/TLS',
      'การเก็บข้อมูลบนเซิร์ฟเวอร์ที่ปลอดภัยตามมาตรฐาน ISO 27001',
      'การควบคุมการเข้าถึงข้อมูลแบบ Role-Based Access Control',
    ],
  },
  {
    title: '4. การเก็บรักษาข้อมูล',
    content: 'เราเก็บรักษาข้อมูลของคุณตลอดระยะเวลาที่ให้บริการ และหลังยกเลิกบริการจะเก็บไว้ไม่เกิน 90 วัน จากนั้นข้อมูลทั้งหมดจะถูกลบอย่างถาวร',
  },
  {
    title: '5. ติดต่อเรา',
    content: 'หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อ:',
    email: 'marosdee.fuzana@gmail.com',
  },
];
