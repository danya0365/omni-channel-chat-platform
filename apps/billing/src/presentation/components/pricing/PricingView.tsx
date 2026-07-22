'use client';

import { usePricingPresenter } from '@/src/presentation/hooks/usePricingPresenter';
import Link from 'next/link';

/**
 * PricingView
 * หน้าราคาสาธารณะ — อ่านอย่างเดียว ไม่ให้ติ๊กฟีเจอร์เอง
 *
 * เหตุผล (ADR-0008): จุดยืนหลักคือ "ราคาไม่บวมตามจำนวนคน" ซึ่งจะแรงก็ต่อเมื่อ
 * ลูกค้าเห็นตัวเลขจริงเทียบกับระบบที่คิดรายหัวได้ — ซ่อนราคาไว้หลังฟอร์มติดต่อ = สารตาย
 * แต่การให้ลูกค้าประกอบราคาเองจาก 72 ฟีเจอร์ทำให้ตัดสินใจไม่ได้ จึงเสนอเป็นแพ็กเกจสำเร็จ
 */
export function PricingView() {
  const { projectTypes, projectType, changeProjectType, cards, formatPrice } =
    usePricingPresenter();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-12 sm:pt-40 sm:pb-16 overflow-hidden bg-grid-pattern">
        <div className="gradient-orb w-72 h-72 bg-primary/20 -top-20 -left-20" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6">
            เพิ่มทีมตอบแชทกี่คน <span className="text-gradient">ราคาก็เท่าเดิม</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            จ่ายค่าติดตั้งครั้งเดียว + ค่าบริการรายเดือนคงที่ —
            ไม่มีค่าใช้งานรายหัว ไม่ต้องคำนวณใหม่ทุกครั้งที่ทีมโต
          </p>
        </div>
      </section>

      {/* เลือกประเภทธุรกิจ */}
      <section className="pb-4">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm text-muted mb-4">ธุรกิจของคุณเป็นแบบไหน?</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {projectTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => changeProjectType(type.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  projectType === type.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'glass-panel text-muted hover:text-foreground'
                }`}
              >
                {type.icon} {type.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* การ์ดแพ็กเกจ */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {cards.map((card) => (
              <div
                key={card.pkg.id}
                className={`glass-panel rounded-2xl p-6 card-hover relative ${
                  card.isRecommended ? 'border-2 border-primary md:-mt-2 md:pb-8' : ''
                }`}
              >
                {card.isRecommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">
                    เลือกมากที่สุด
                  </span>
                )}

                <div className="text-3xl mb-2">{card.pkg.icon}</div>
                <h2 className="text-xl font-bold mb-1">{card.pkg.name}</h2>
                <p className="text-sm text-muted mb-5 min-h-10">{card.pkg.description}</p>

                <div className="mb-1">
                  <span className="text-sm text-muted">ค่าติดตั้งเริ่มต้น</span>
                  <div className="text-3xl font-bold text-gradient">
                    {formatPrice(card.setup)}
                  </div>
                </div>
                <div className="mb-5">
                  <span className="text-sm text-muted">
                    + รายเดือน <strong className="text-foreground">{formatPrice(card.monthly)}</strong>
                    <span className="text-xs"> /เดือน (ทั้งทีม)</span>
                  </span>
                </div>

                <ul className="space-y-2 mb-6">
                  {card.highlights.map((highlight) => (
                    <li key={highlight} className="text-sm flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/contact"
                  className={`block text-center py-2.5 rounded-xl font-bold transition-all ${
                    card.isRecommended
                      ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20'
                      : 'glass-panel hover:text-primary'
                  }`}
                >
                  ขอเดโม
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted mt-8 max-w-2xl mx-auto">
            ราคาข้างต้นเป็น<strong className="text-foreground">ราคาประมาณการเริ่มต้น</strong>
            ยังไม่รวม VAT · ราคาจริงขึ้นกับช่องทางที่ต่อ ขอบเขตงาน และรูปแบบทีมที่ดูแลให้ —
            เราออกใบเสนอราคาที่ระบุทุกอย่างชัดเจนให้ก่อนเริ่มงานเสมอ
          </p>
        </div>
      </section>

      {/* จุดยืนเรื่องราคา */}
      <section className="py-16 bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            ทำไมเราไม่คิดค่าใช้งานรายหัว
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel rounded-xl p-6">
              <div className="text-2xl mb-3">👥</div>
              <h3 className="font-bold mb-2">ทีมโตแล้วต้นทุนไม่โต</h3>
              <p className="text-sm text-muted">
                ระบบที่คิดรายหัว ยิ่งเพิ่มคนตอบแชทยิ่งจ่ายมากขึ้นทุกเดือน
                ของเราเพิ่มกี่คนก็ค่าบริการเท่าเดิม — ช่วงพีคเพิ่มคนได้โดยไม่ต้องคิดเรื่องบิล
              </p>
            </div>
            <div className="glass-panel rounded-xl p-6">
              <div className="text-2xl mb-3">🏢</div>
              <h3 className="font-bold mb-2">หลายแบรนด์บนระบบเดียว</h3>
              <p className="text-sm text-muted">
                แยก workspace ต่อแบรนด์/ต่อลูกค้าได้ตั้งแต่แรก ข้อมูลไม่ปนกัน
                เอเจนซี่รับงานเพิ่มโดยไม่ต้องซื้อระบบใหม่ทุกราย
              </p>
            </div>
            <div className="glass-panel rounded-xl p-6">
              <div className="text-2xl mb-3">🔐</div>
              <h3 className="font-bold mb-2">ข้อมูลอยู่กับคุณ</h3>
              <p className="text-sm text-muted">
                ติดตั้งบนเซิร์ฟเวอร์ของคุณเองได้ ข้อความลูกค้าไม่ต้องฝากไว้กับ SaaS ต่างชาติ
                credential ของแต่ละช่องทางเก็บแบบเข้ารหัส
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">อยากได้ราคาที่ตรงกับงานจริง?</h2>
          <p className="text-muted mb-8">
            บอกเราว่าตอนนี้ตอบลูกค้าจากช่องทางไหนบ้าง ทีมกี่คน
            แล้วเราจะทำใบเสนอราคาเทียบให้เลือกหลายแบบ
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="btn-primary text-lg px-8 py-3 rounded-xl inline-flex items-center gap-2"
            >
              ขอเดโม
            </Link>
            <Link
              href="/about"
              className="btn-ghost text-lg px-8 py-3 rounded-xl inline-flex items-center gap-2"
            >
              รู้จักเราก่อน
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
