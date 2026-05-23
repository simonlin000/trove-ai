import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import ClientLayout from './ClientLayout';
import AuthGuard from '@/components/AuthGuard';
import MainShell from '@/components/MainShell';

export const metadata: Metadata = {
  title: 'Trove AI · 拾遗 — AI 驱动的稍后读 + 知识库',
  description: '中文互联网内容的个人 AI 稍后读 + 知识库 —— 一键收藏、AI 自动梳理、语义检索、知识图谱、Obsidian 同步备份。',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ClientLayout>
            <AuthGuard>
              <MainShell>
                {children}
              </MainShell>
            </AuthGuard>
          </ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
