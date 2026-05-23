'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AIAssistant from '@/components/AIAssistant';
import ViewAsBanner from '@/components/ViewAsBanner';

export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Login page: render content only, no sidebar or AI assistant
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 md:ml-60 min-h-screen transition-all duration-300 pt-14 md:pt-0">
          <ViewAsBanner />
          {children}
        </main>
      </div>
      <AIAssistant />
    </>
  );
}
