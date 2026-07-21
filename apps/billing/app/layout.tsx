import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "../public/styles/index.css";
import { ThemeProvider } from "../src/presentation/components/providers/ThemeProvider";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "OmniChat — ระบบแชทรวมทุกช่องทาง ที่ไม่คิดค่าหัวรายเดือนต่อผู้ใช้",
  description:
    "รวมแชทลูกค้าจากทุกช่องทางไว้จอเดียว จ่ายค่าติดตั้งครั้งเดียว + รายเดือนคงที่ เพิ่มทีมกี่คนราคาก็เท่าเดิม · เอเจนซี่แยก workspace ต่อแบรนด์บนระบบเดียวได้",
  keywords: [
    "Omni-Channel Chat",
    "ระบบแชทรวมทุกช่องทาง",
    "inbox รวมทุกช่องทาง",
    "ระบบแชทสำหรับเอเจนซี่",
    "multi-tenant chat platform",
    "LINE OA",
    "self-host chat",
  ],
  authors: [{ name: "OmniChat Team" }],
  openGraph: {
    title: "OmniChat — ระบบแชทรวมทุกช่องทาง ที่ไม่คิดค่าหัวรายเดือนต่อผู้ใช้",
    description:
      "รวมแชททุกช่องทางไว้จอเดียว เพิ่มทีมกี่คนราคาก็เท่าเดิม · เลือกฟีเจอร์เอง เห็นราคาทันที",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${notoSansThai.variable} font-[family-name:var(--font-noto-sans-thai)] antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
