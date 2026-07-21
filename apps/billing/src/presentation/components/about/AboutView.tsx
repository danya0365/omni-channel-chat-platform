'use client';

import { cn } from '../../utils/cn';

/**
 * AboutView Component
 * Company and team information page for OmniChat
 * Following Clean Architecture - UI only, no business logic
 */
import { useTrail, animated, useSpring, config } from 'react-spring';

/**
 * AboutView Component
 * Company and team information page for OmniChat
 * Following Clean Architecture - UI only, no business logic
 */
export function AboutView() {
  const heroSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(30px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: config.gentle,
  });

  const statsTrail = useTrail(4, {
    from: { opacity: 0, transform: 'scale(0.9)' },
    to: { opacity: 1, transform: 'scale(1)' },
    delay: 300,
    config: config.stiff,
  });

  const contentSpring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    delay: 600,
  });

  return (
    <div className="about-page">
      {/* Hero Section - Truly Full Width */}
      <animated.section 
        className={cn(
          "about-hero relative pt-32 pb-20 md:pt-48 md:pb-36 overflow-hidden"
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
          <h1 className="about-hero-title">
            เราคือ <span className="text-gradient">OmniChat</span>
          </h1>
          <p className="about-hero-subtitle">
            ผู้เชี่ยวชาญด้านระบบแชทธุรกิจ รวมทุกช่องทางไว้ในจอเดียว
            พร้อมบอทและ automation สำหรับธุรกิจทุกขนาด
          </p>
        </div>
      </animated.section>

      {/* Contained Content Sections */}
      <div className="about-container">
        {/* Stats */}
        <section className="about-stats mt-[-4rem] relative z-20">
          {statsTrail.map((style, index) => {
            const stat = STATS_DATA[index];
            return (
              <animated.div key={stat.label} style={style} className="about-stat">
                <span className="about-stat-value">{stat.value}</span>
                <span className="about-stat-label">{stat.label}</span>
              </animated.div>
            );
          })}
        </section>

        <animated.div style={contentSpring}>
          {/* Mission & Vision */}
          <section className="about-section mt-16">
            <div className="about-grid">
              <div className="about-card">
                <span className="about-card-icon">🎯</span>
                <h3 className="about-card-title">พันธกิจ</h3>
                <p className="about-card-text">
                  พัฒนาระบบแชทที่ใช้งานง่าย ราคาเข้าถึงได้
                  เพื่อให้ธุรกิจทุกขนาดตอบลูกค้าได้เร็วขึ้น ไม่มีข้อความตกหล่น
                </p>
              </div>
              <div className="about-card">
                <span className="about-card-icon">🔭</span>
                <h3 className="about-card-title">วิสัยทัศน์</h3>
                <p className="about-card-text">
                  เป็นระบบแชทธุรกิจที่ทีมงานไทยเลือกใช้เป็นอันดับต้นๆ
                  ด้วยเทคโนโลยี AI และ Automation ที่ล้ำสมัย
                </p>
              </div>
            </div>
          </section>

          {/* Why Choose Us */}
          <section className="about-section">
            <h2 className="about-section-title">ทำไมต้องเลือกเรา?</h2>
            <div className="about-features-grid">
              {ABOUT_FEATURES.map((feature) => (
                <div key={feature.title} className="about-feature">
                  <span className="about-feature-icon">{feature.icon}</span>
                  <h4 className="about-feature-title">{feature.title}</h4>
                  <p className="about-feature-text">{feature.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section className="about-section">
            <h2 className="about-section-title">ทีมงานของเรา</h2>
            <div className="about-team-grid">
              {TEAM_MEMBERS.map((member) => (
                <div key={member.name + member.role} className="about-team-member">
                  <div className="about-team-avatar">{member.avatar}</div>
                  <h4 className="about-team-name">{member.name}</h4>
                  <p className="about-team-role">{member.role}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Contact CTA */}
          <section className="about-cta mb-12">
            <h2 className="about-cta-title">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
            <p className="about-cta-subtitle">
              ติดต่อเราวันนี้ รับส่วนลดพิเศษสำหรับลูกค้าใหม่
            </p>
            <div className="about-cta-buttons">
              <a href="/builder" className="about-cta-btn primary">
                สร้างใบเสนอราคา
              </a>
              <a href="tel:0894847773" className="about-cta-btn secondary">
                📞 089-484-7773
              </a>
            </div>
          </section>
        </animated.div>
      </div>
    </div>
  );
}

const STATS_DATA = [
  { value: '500+', label: 'ลูกค้าที่ไว้วางใจ' },
  { value: '10+', label: 'ปีประสบการณ์' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support' },
];

// ============================================
// Content Data
// ============================================

const ABOUT_FEATURES = [
  { icon: '⚡', title: 'ติดตั้งเร็ว', text: 'พร้อมใช้งานภายใน 24 ชั่วโมง' },
  { icon: '🛡️', title: 'ปลอดภัย', text: 'ข้อความลูกค้าเข้ารหัส ปลอดภัย' },
  { icon: '📱', title: 'ใช้ง่าย', text: 'ไม่ต้องมีความรู้ IT ก็ใช้ได้' },
  { icon: '💰', title: 'คุ้มค่า', text: 'จ่ายแค่ฟีเจอร์ที่ใช้จริง' },
  { icon: '🔧', title: 'ซัพพอร์ต', text: 'ทีมสนับสนุนตลอด 24 ชม.' },
  { icon: '📈', title: 'อัพเดทฟรี', text: 'รับฟีเจอร์ใหม่โดยไม่มีค่าใช้จ่าย' },
];

const TEAM_MEMBERS = [
  { avatar: '👨‍💼', name: 'คุณมะรอสดี อุมา', role: 'CEO & Founder' },
  { avatar: '👩‍💻', name: 'คุณฟูซาน่า มะเซ็ง', role: 'CTO' },
  { avatar: '👨‍🎨', name: 'คุณฟูซาน่า มะเซ็ง', role: 'Lead Designer' },
  { avatar: '👩‍🔧', name: 'คุณมะรอสดี อุมา', role: 'Support Lead' },
];
