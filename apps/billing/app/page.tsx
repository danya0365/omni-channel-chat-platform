import { HomeView } from "@/src/presentation/components/home/HomeView";
import { MainLayout } from "@/src/presentation/components/layout/MainLayout";
import type { Metadata } from "next";

// Tell Next.js this is a dynamic page
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Generate metadata for the Home page
 */
export const metadata: Metadata = {
  title: "OmniChat — เพิ่มทีมตอบแชทกี่คน ราคาก็เท่าเดิม",
  description: "ระบบแชทรวมทุกช่องทางไว้จอเดียว ที่ไม่คิดค่าหัวรายเดือนต่อผู้ใช้ — จ่ายค่าติดตั้งครั้งเดียว + รายเดือนคงที่ · เอเจนซี่แยก workspace ต่อแบรนด์บนระบบเดียวได้ · เลือกฟีเจอร์เอง เห็นราคาทันที",
  openGraph: {
    title: "OmniChat — เพิ่มทีมตอบแชทกี่คน ราคาก็เท่าเดิม",
    description: "ระบบแชทรวมทุกช่องทางที่ไม่คิดค่าหัวต่อผู้ใช้ · เลือกฟีเจอร์เอง เห็นราคาทันที",
    type: "website",
  },
};

/**
 * Home Page - Server Component
 * Landing page for OmniChat Quotation Builder
 */
export default function HomePage() {
  return (
    <MainLayout showBubbles={true}>
      <HomeView />
    </MainLayout>
  );
}
