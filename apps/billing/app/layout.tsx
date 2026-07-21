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
  title: "OmniChat — ระบบสร้างใบเสนอราคาแพลตฟอร์มแชทรวมทุกช่องทาง",
  description:
    "สร้างใบเสนอราคาระบบแชทรวมทุกช่องทาง (Omni-Channel Chat Platform) คุณเลือกฟีเจอร์ เราคำนวณราคาให้",
  keywords: [
    "Omni-Channel Chat",
    "ใบเสนอราคา",
    "Quotation Builder",
    "ระบบแชทรวมทุกช่องทาง",
    "LINE OA",
  ],
  authors: [{ name: "OmniChat Team" }],
  openGraph: {
    title: "OmniChat — ระบบสร้างใบเสนอราคาแพลตฟอร์มแชทรวมทุกช่องทาง",
    description:
      "สร้างใบเสนอราคาระบบแชทรวมทุกช่องทางแบบเลือกฟีเจอร์เองได้",
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
