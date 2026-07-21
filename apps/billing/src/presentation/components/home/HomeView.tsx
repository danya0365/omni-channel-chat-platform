'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Landing page features data
 */
const FEATURES = [
  {
    id: 'feature-1',
    icon: '💬',
    title: 'รวมทุกช่องทางไว้ในจอเดียว',
    description: 'LINE, Messenger, Instagram, WhatsApp, เว็บ, อีเมล — ทีมตอบจากกล่องเดียว ไม่ต้องสลับแอป',
  },
  {
    id: 'feature-2',
    icon: '⚡',
    title: 'Realtime ทั้งทีม',
    description: 'ข้อความเด้งเข้าทันทีผ่าน WebSocket หลาย agent เห็นตรงกัน ไม่ต้องกด refresh',
  },
  {
    id: 'feature-3',
    icon: '🎯',
    title: 'มอบหมายงานชัด ไม่ตอบซ้ำ',
    description: 'รับสาย/โอน/ปิดสาย เห็นชัดว่าใครดูแลสายไหน กันสายตกหล่นและตอบชนกัน',
  },
  {
    id: 'feature-4',
    icon: '🤖',
    title: 'บอทตอบอัตโนมัติ 24 ชม.',
    description: 'ตั้ง keyword rule ให้บอทตอบคำถามซ้ำๆ เอง ตอบไม่ได้ก็ส่งต่อคนจริงทันที',
  },
  {
    id: 'feature-5',
    icon: '👥',
    title: 'ประวัติลูกค้ารวมศูนย์',
    description: 'ลูกค้า 1 คน = 1 โปรไฟล์ เห็นบทสนทนาทุกช่องทางย้อนหลังได้ครบ',
  },
  {
    id: 'feature-6',
    icon: '🔒',
    title: 'ข้อมูลอยู่กับคุณ',
    description: 'เข้ารหัส credential AES-256-GCM · ตรวจลายเซ็น webhook · self-host ได้ ไม่ผูก SaaS ต่างชาติ',
  },
];

/**
 * Landing page stats
 */
const STATS = [
  { id: 'stat-1', value: '฿27,000', label: 'เริ่มต้น (Solo dev + AI)' },
  { id: 'stat-2', value: '70+', label: 'ฟีเจอร์ให้เลือก' },
  { id: 'stat-3', value: '10+', label: 'ช่องทางที่เชื่อมได้' },
  { id: 'stat-4', value: '4', label: 'รูปแบบทีมให้เลือกจ้าง' },
];

/**
 * Testimonials
 */
const TESTIMONIALS = [
  {
    id: 'testimonial-1',
    name: 'คุณสมชาย',
    role: 'เจ้าของร้าน',
    company: 'ร้านค้าออนไลน์',
    avatar: '👨‍💼',
    content: 'เมื่อก่อนเปิด 4 แอปตอบลูกค้า ตอนนี้จอเดียวจบ ไม่มีข้อความหลุดอีกเลย',
    rating: 5,
  },
  {
    id: 'testimonial-2',
    name: 'คุณวิมล',
    role: 'หัวหน้าทีมซัพพอร์ต',
    company: 'ธุรกิจบริการ',
    avatar: '👩‍💼',
    content: 'รู้ชัดว่าใครถือสายไหน ไม่ตอบชนกันแล้ว เวลาตอบครั้งแรกเร็วขึ้นเห็นๆ',
    rating: 5,
  },
  {
    id: 'testimonial-3',
    name: 'คุณพิชัย',
    role: 'ผู้บริหาร',
    company: 'เอเจนซี่ดูแลหลายแบรนด์',
    avatar: '🧑‍💼',
    content: 'ระบบเดียวรับลูกค้าได้หลายเจ้า แยก workspace ชัด ไม่ต้องซื้อเครื่องมือเพิ่มต่อลูกค้า',
    rating: 5,
  },
];

/**
 * FAQ items
 */
const FAQ_ITEMS = [
  {
    id: 'faq-1',
    question: 'OmniChat คืออะไร?',
    answer:
      'แพลตฟอร์มรวมข้อความลูกค้าจากทุกช่องทาง (LINE, Messenger, Instagram, WhatsApp, เว็บ, อีเมล) มาไว้ในกล่องเดียว พร้อมระบบมอบหมายงาน บอทตอบอัตโนมัติ และประวัติลูกค้ารวมศูนย์',
  },
  {
    id: 'faq-2',
    question: 'ราคาคิดยังไง?',
    answer:
      'แยก 2 ก้อน: ค่าติดตั้งครั้งเดียว (ตามฟีเจอร์ที่เลือก) + ค่าบริการรายเดือน (ครอบคลุม hosting, ค่าเชื่อมต่อช่องทาง และการดูแลระบบ) — เลือกเฉพาะที่ใช้จริง ไม่ต้องจ่ายของที่ไม่ได้ใช้ และยังเลือกรูปแบบทีมที่ทำให้ได้ ราคาปรับตามนั้นอีกชั้น',
  },
  {
    id: 'faq-tier',
    question: 'จ้างทำได้กี่แบบ ราคาต่างกันยังไง?',
    answer:
      '4 แบบ เลือกได้เองในหน้า Builder — (1) Solo dev + AI: ถูกที่สุด ใช้ AI ช่วยเขียนโค้ด แต่คนเดียวดูแลทั้งโปรเจค (2) Solo dev: คนเดียวเต็มตัว รับผิดชอบชัด (3) ทีมเล็ก 2-3 คน: ส่งงานเร็วขึ้น มีคนรีวิว/แทนกันได้ (4) บริษัท/ทีมใหญ่: มี PM, QA, designer และ SLA ครบ ราคาสูงสุด · ราคาที่แสดงในหน้าเว็บคือเรตของแบบที่ 1 (ถูกที่สุด) แบบอื่นจะบวกเพิ่มตามสัดส่วนที่ระบุไว้ชัดเจน',
  },
  {
    id: 'faq-channels',
    question: 'เลือกหลายช่องทางแล้วราคาจะบานปลายไหม?',
    answer:
      'ไม่บานครับ — ช่องทางแชทคือหัวใจของระบบนี้ เราจึงตั้งราคาให้เลือกได้เต็มที่: ช่องทางมาตรฐาน (เว็บ, LINE, Messenger, Instagram, Telegram, อีเมล) ช่องทางที่ 2 เป็นต้นไปลด 30% และ **รวมกันทั้งหมดไม่เกิน ฿10,000** ต่อให้เลือกครบทุกช่องทางก็ตาม · ส่วนช่องทางพิเศษ (WhatsApp, TikTok, Shopee/Lazada) แยกราคาต่างหาก เพราะต้นทุนจริงคือการขออนุมัติจากผู้ให้บริการ — WhatsApp ต้องยืนยันธุรกิจกับ Meta, Shopee/Lazada ไม่มี chat API สาธารณะ ต้องรออนุมัติและอาจไม่ผ่าน',
  },
  {
    id: 'faq-3',
    question: 'ต้องเลือกทุกฟีเจอร์ไหม ถ้างบจำกัด?',
    answer:
      'ไม่ต้องครับ เริ่มจากช่องทางที่ใช้บ่อยที่สุด (เช่น LINE + เว็บ) แล้วค่อยเพิ่มทีหลังได้ — architecture ออกแบบให้เสียบช่องทาง/ฟีเจอร์เพิ่มโดยไม่ต้องรื้อระบบเดิม',
  },
  {
    id: 'faq-4',
    question: 'บอทกับ AI ต่างกันยังไง?',
    answer:
      'บอท keyword rule = ตั้งคำสำคัญให้ตอบข้อความสำเร็จรูป แม่นยำ ควบคุมได้ 100% (พร้อมใช้งานจริง) · ส่วน AI ช่วยตอบ (Claude) อยู่ในช่วง beta — ใช้ตอบคำถามที่ rule ไม่ครอบ และเปิด/ปิดได้ต่อ workspace',
  },
  {
    id: 'faq-5',
    question: 'ข้อมูลลูกค้าปลอดภัยแค่ไหน?',
    answer:
      'token ของแต่ละช่องทางเข้ารหัส AES-256-GCM ใน DB · ตรวจลายเซ็น webhook ทุกครั้ง · แยกข้อมูลรายธุรกิจด้วย workspace · ไม่เก็บ log ข้อความลูกค้าแบบ plaintext · เลือก self-host ให้ข้อมูลอยู่ในองค์กรได้',
  },
  {
    id: 'faq-6',
    question: 'ใช้เวลาติดตั้งนานเท่าไหร่?',
    answer:
      'หลังยืนยันใบเสนอราคา ทีมงานจะเก็บ requirements และ setup ให้ ปกติ 5-15 วันทำการ ขึ้นกับจำนวนช่องทางและฟีเจอร์ที่เลือก',
  },
];

/**
 * HomeView Component
 * Landing page for OmniChat Quotation Builder
 */
export function HomeView() {
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  return (
    <div className="min-h-screen">
      {/* ── Hero Section ── */}
      <section 
        className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-36 overflow-hidden bg-grid-pattern"
        style={{
          background: 'linear-gradient(to bottom, var(--header-bg), var(--color-background))',
        }}
      >
        {/* Gradient Orbs */}
        <div className="gradient-orb w-72 h-72 bg-primary/20 -top-20 -left-20" />
        <div className="gradient-orb w-96 h-96 bg-accent/15 -bottom-32 -right-20" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in-up">
            <span>💬</span>
            <span>Omni-Channel Chat Platform</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            สร้างใบเสนอราคา
            <br />
            <span className="text-gradient">ระบบแชทรวมทุกช่องทาง</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            เลือกช่องทาง ฟีเจอร์ และ<strong>ทีมที่จะทำให้</strong> — ระบบคำนวณราคาให้ทันที
            <br className="hidden sm:block" />
            งบจำกัดจ้าง solo dev + AI เริ่มต้นหลักหมื่น · องค์กรใหญ่เลือกทีมเต็มได้
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link
              href="/builder"
              className="btn-primary text-lg px-8 py-3 rounded-xl inline-flex items-center gap-2"
            >
              <span>🛠️</span>
              <span>สร้างใบเสนอราคา</span>
            </Link>
            <Link
              href="/about"
              className="btn-ghost text-lg px-8 py-3 rounded-xl inline-flex items-center gap-2"
            >
              <span>ℹ️</span>
              <span>เรียนรู้เพิ่มเติม</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section className="py-16 bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.id} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gradient mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ฟีเจอร์ครบ เลือกเท่าที่ใช้ จ่ายเท่าที่เลือก
            </h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">
              70+ ฟีเจอร์ใน 10 โมดูล + เลือกได้ว่าจะจ้างทีมแบบไหน — ติ๊กเลือกเอง ระบบคำนวณราคาให้อัตโนมัติ
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.id}
                className="glass-panel rounded-xl p-6 card-hover"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials Section ── */}
      <section className="py-20 sm:py-24 bg-surface-alt">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ลูกค้าของเราพูดถึงเรา
            </h2>
            <p className="text-muted text-lg">
              ความคิดเห็นจากผู้ใช้งานจริง
            </p>
          </div>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.id}
                className="glass-panel rounded-xl p-6 card-hover"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <span key={i} className="text-amber-400">⭐</span>
                  ))}
                </div>

                {/* Content */}
                <p className="text-foreground text-sm leading-relaxed mb-6">
                  &quot;{testimonial.content}&quot;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{testimonial.avatar}</span>
                  <div>
                    <div className="font-semibold text-sm">{testimonial.name}</div>
                    <div className="text-muted text-xs">
                      {testimonial.role} · {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              คำถามที่พบบ่อย
            </h2>
            <p className="text-muted text-lg">
              หากมีคำถามเพิ่มเติม สามารถติดต่อเราได้ตลอด
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((faq) => (
              <div
                key={faq.id}
                className="glass-panel rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
                >
                  <span className="font-semibold text-sm sm:text-base pr-4">
                    {faq.question}
                  </span>
                  <span
                    className={`text-muted transition-transform duration-300 flex-shrink-0 ${
                      openFaqId === faq.id ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {openFaqId === faq.id && (
                  <div className="px-6 pb-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
                    <p className="text-muted text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-20 sm:py-24 bg-surface-alt">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            พร้อมเริ่มต้นแล้วหรือยัง?
          </h2>
          <p className="text-muted text-lg mb-8">
            ประเมินราคาระบบแชทของคุณเองได้ฟรี ใช้เวลาไม่ถึง 5 นาที
          </p>
          <Link
            href="/builder"
            className="btn-primary text-lg px-10 py-4 rounded-xl inline-flex items-center gap-2"
          >
            <span>🚀</span>
            <span>เริ่มสร้างใบเสนอราคาเลย</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
