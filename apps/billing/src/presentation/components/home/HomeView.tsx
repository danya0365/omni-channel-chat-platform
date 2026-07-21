'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Landing page features data
 */
const FEATURES = [
  {
    id: 'feature-1',
    icon: '💸',
    title: 'เพิ่มคนตอบแชท ราคาไม่ขยับ',
    description:
      'จ่ายค่าติดตั้งครั้งเดียว + รายเดือนคงที่ ทีม 3 คนหรือ 30 คนก็ราคาเดียวกัน — ไม่มีค่าหัวรายเดือนต่อผู้ใช้',
  },
  {
    id: 'feature-2',
    icon: '🏢',
    title: 'หลายแบรนด์ หลายลูกค้า ระบบเดียว',
    description:
      'แยก workspace ต่อแบรนด์บน deployment เดียว รับลูกค้าเพิ่มโดยไม่ต้องซื้อเครื่องมือใหม่ต่อราย',
  },
  {
    id: 'feature-3',
    icon: '💬',
    title: 'รวมทุกช่องทางไว้ในจอเดียว',
    description:
      'พร้อมใช้วันนี้: LINE + แชทบนเว็บ · Messenger, Instagram, WhatsApp, Telegram, อีเมล สั่งเสียบเพิ่มได้ตามต้องการ',
  },
  {
    id: 'feature-4',
    icon: '🎯',
    title: 'มอบหมายงานชัด ไม่ตอบซ้ำ',
    description:
      'รับสาย/โอน/ปิดสาย เห็นชัดว่าใครดูแลสายไหน ข้อความเด้งเข้าทันที ทุกคนในทีมเห็นตรงกัน',
  },
  {
    id: 'feature-5',
    icon: '🤖',
    title: 'บอทตอบอัตโนมัติ 24 ชม.',
    description:
      'ตั้ง keyword rule เองได้จากหน้าจอ ตอบไม่ได้ก็ส่งต่อคนจริงทันที · AI ช่วยตอบอยู่ในช่วง beta',
  },
  {
    id: 'feature-6',
    icon: '🔒',
    title: 'ข้อมูลอยู่กับคุณ',
    description:
      'เข้ารหัส credential AES-256-GCM · ตรวจลายเซ็น webhook · self-host ได้ ไม่ผูก SaaS ต่างชาติ',
  },
];

/**
 * Landing page stats — ตัวเลขต้องพิสูจน์ได้จากระบบจริง/ใบเสนอราคา (ห้ามใส่เลขลอย)
 */
const STATS = [
  { id: 'stat-1', value: '฿0', label: 'ค่าหัวรายเดือนต่อผู้ใช้' },
  { id: 'stat-2', value: 'ไม่จำกัด', label: 'จำนวนคนในทีม / แบรนด์' },
  { id: 'stat-3', value: '70+', label: 'ฟีเจอร์ เลือกจ่ายเท่าที่ใช้' },
  { id: 'stat-4', value: '฿27,000', label: 'เริ่มต้น (ติดตั้งครั้งเดียว)' },
];

/**
 * "เหมาะกับใคร" — use-case จริงที่ระบบตอบได้
 * ⚠️ ห้ามแทนที่ด้วย testimonial/รีวิวสมมติ จนกว่าจะมีลูกค้าจริงที่ยินยอมให้อ้างอิง (ADR-0008)
 */
const USE_CASES = [
  {
    id: 'use-case-1',
    icon: '🏢',
    title: 'เอเจนซี่ / ดูแลหลายแบรนด์',
    situation: 'รับดูแลแชทให้ลูกค้าหลายเจ้า ต้องซื้อเครื่องมือ (และจ่ายค่าหัว) เพิ่มทุกครั้งที่ได้ลูกค้าใหม่',
    outcome: 'แยก workspace ต่อลูกค้าบน deployment เดียว รับงานเพิ่มโดยต้นทุนต่อรายแทบไม่ขยับ',
  },
  {
    id: 'use-case-2',
    icon: '🎧',
    title: 'ธุรกิจบริการ / ศูนย์ซัพพอร์ต',
    situation: 'ทีม 5–20 คนตอบพร้อมกัน ไม่รู้ว่าใครถือสายไหน ตอบชนกันบ้าง ตกหล่นบ้าง',
    outcome: 'รับสาย/โอน/ปิดสายชัดเจน เห็นสถานะทุกสายแบบ realtime คุมเวลาตอบครั้งแรกได้',
  },
  {
    id: 'use-case-3',
    icon: '🛒',
    title: 'ร้านค้า / อีคอมเมิร์ซ',
    situation: 'ลูกค้าทักมาหลายช่องทาง คำถามซ้ำๆ กินเวลาทีม ข้อความหลุดตอนคนล้น',
    outcome: 'รวมทุกช่องทางไว้จอเดียว ให้บอทรับคำถามซ้ำ เหลือคนไว้ตอบเคสที่ปิดการขายได้',
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
      'แพลตฟอร์มรวมข้อความลูกค้าจากทุกช่องทางมาไว้ในกล่องเดียว พร้อมระบบมอบหมายงาน บอทตอบอัตโนมัติ และประวัติลูกค้ารวมศูนย์ · ช่องทางที่เชื่อมได้ทันทีตอนนี้คือ LINE และแชทบนเว็บ ส่วน Messenger, Instagram, WhatsApp, Telegram และอีเมล เป็นช่องทางที่สั่งเสียบเพิ่มได้ — ระบบออกแบบมาให้เพิ่มช่องทางโดยไม่ต้องรื้อของเดิม',
  },
  {
    id: 'faq-seats',
    question: 'ทีมโตขึ้นแล้วค่าใช้จ่ายเพิ่มไหม?',
    answer:
      'ไม่เพิ่มตามจำนวนคนครับ — เราไม่คิดค่าหัวรายเดือนต่อผู้ใช้ (per-seat) แบบเครื่องมือ SaaS ทั่วไป · คุณจ่ายค่าติดตั้งครั้งเดียวตามฟีเจอร์ที่เลือก + ค่าบริการรายเดือนคงที่ จะเพิ่มคนตอบแชทจาก 3 เป็น 30 คน ค่ารายเดือนก็เท่าเดิม · ค่าใช้จ่ายจะขยับก็ต่อเมื่อคุณสั่งเพิ่มฟีเจอร์หรือช่องทางใหม่ ซึ่งเป็นการตัดสินใจของคุณเอง ไม่ใช่บิลที่โตเงียบๆ ตามขนาดทีม',
  },
  {
    id: 'faq-agency',
    question: 'รับดูแลลูกค้าหลายเจ้า / หลายแบรนด์ได้ไหม?',
    answer:
      'ได้ครับ ระบบออกแบบเป็น multi-tenant มาตั้งแต่วันแรก — แต่ละแบรนด์หรือลูกค้าแยกเป็น workspace ของตัวเอง ข้อมูล บทสนทนา ช่องทาง และทีมงานไม่ปนกัน แต่รันอยู่บน deployment เดียว · เอเจนซี่จึงรับลูกค้าเพิ่มได้โดยไม่ต้องซื้อ subscription ใหม่ต่อราย และยังเลือกเปิด/ปิดฟีเจอร์ให้แต่ละ workspace ต่างกันได้ตามแพ็กเกจที่ลูกค้าแต่ละเจ้าจ่าย',
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
            <span>🏢</span>
            <span>สำหรับเอเจนซี่ · ธุรกิจหลายแบรนด์ · ทีมซัพพอร์ต</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            เพิ่มทีมตอบแชทกี่คน
            <br />
            <span className="text-gradient">ราคาก็เท่าเดิม</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            ระบบแชทรวมทุกช่องทางไว้จอเดียว ที่<strong>ไม่คิดค่าหัวรายเดือนต่อผู้ใช้</strong>
            <br className="hidden sm:block" />
            จ่ายค่าติดตั้งครั้งเดียว + รายเดือนคงที่ · เอเจนซี่แยก workspace ต่อแบรนด์บนระบบเดียวได้
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link
              href="/builder"
              className="btn-primary text-lg px-8 py-3 rounded-xl inline-flex items-center gap-2"
            >
              <span>🛠️</span>
              <span>ดูราคาของคุณ</span>
            </Link>
            <Link
              href="/contact"
              className="btn-ghost text-lg px-8 py-3 rounded-xl inline-flex items-center gap-2"
            >
              <span>📞</span>
              <span>ขอเดโม</span>
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
              70+ ฟีเจอร์ใน 10 โมดูล — ติ๊กเลือกเอง ระบบคำนวณราคาให้ทันที
              ไม่มีแพ็กเกจบังคับซื้อของที่ไม่ได้ใช้
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

      {/* ── Use Cases Section ── */}
      <section className="py-20 sm:py-24 bg-surface-alt">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              ระบบนี้เหมาะกับใคร
            </h2>
            <p className="text-muted text-lg">
              สถานการณ์ที่เจอบ่อย และสิ่งที่เปลี่ยนไปหลังใช้ระบบ
            </p>
          </div>

          {/* Use Case Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {USE_CASES.map((useCase) => (
              <div
                key={useCase.id}
                className="glass-panel rounded-xl p-6 card-hover flex flex-col"
              >
                <div className="text-3xl mb-4">{useCase.icon}</div>
                <h3 className="text-lg font-semibold mb-4">{useCase.title}</h3>

                {/* ปัญหาเดิม */}
                <div className="mb-4">
                  <div className="text-muted text-xs font-medium mb-1 uppercase tracking-wide">
                    ปัญหาที่เจอ
                  </div>
                  <p className="text-muted text-sm leading-relaxed">
                    {useCase.situation}
                  </p>
                </div>

                {/* หลังใช้ระบบ */}
                <div className="mt-auto pt-4 border-t border-border">
                  <div className="text-primary text-xs font-medium mb-1 uppercase tracking-wide">
                    หลังใช้ระบบ
                  </div>
                  <p className="text-foreground text-sm leading-relaxed">
                    {useCase.outcome}
                  </p>
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
                    className={`text-muted transition-transform duration-300 shrink-0 ${
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
            อยากรู้ว่าระบบของคุณราคาเท่าไหร่?
          </h2>
          <p className="text-muted text-lg mb-8">
            ติ๊กเลือกช่องทางและฟีเจอร์ที่ต้องการ เห็นราคาทันที ไม่ต้องกรอกอีเมล ไม่ต้องรอเซลล์ติดต่อกลับ
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/builder"
              className="btn-primary text-lg px-10 py-4 rounded-xl inline-flex items-center gap-2"
            >
              <span>🚀</span>
              <span>ดูราคาของคุณ</span>
            </Link>
            <Link
              href="/contact"
              className="btn-ghost text-lg px-10 py-4 rounded-xl inline-flex items-center gap-2"
            >
              <span>📞</span>
              <span>คุยกับทีมงาน</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
