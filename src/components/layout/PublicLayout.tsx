import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';

export function PublicLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-black text-brand-white">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
