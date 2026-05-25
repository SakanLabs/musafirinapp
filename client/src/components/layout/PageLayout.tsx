import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { ProfileDropdown } from './ProfileDropdown';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showBackButton?: boolean;
  children: ReactNode;
}

export function PageLayout({
  title,
  subtitle,
  actions,
  showBackButton = false,
  children
}: PageLayoutProps) {
  const router = useRouter();

  const handleBack = () => {
    router.history.back();
  };

  return (
    <div className="h-screen overflow-hidden bg-[#ffffff] flex">
      {/* Pinned Shell Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-[#ffffff]">
        {/* Pinned Shell Header (64px / h-16) */}
        <header className="flex-shrink-0 bg-white border-b border-[#e5e7eb] z-10">
          <div className="w-full px-6 sm:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 lg:ml-0 ml-12">
                {showBackButton && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="p-2 rounded-full hover:bg-gray-50 border border-transparent hover:border-[#e5e7eb] transition-all"
                  >
                    <ArrowLeft className="h-4 w-4 text-[#111111]" />
                  </Button>
                )}
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold tracking-[-0.03em] text-[#111111] font-sans">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-[11px] text-gray-400 font-medium tracking-wide mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Toolbar & Profile Dropdown */}
              <div className="flex items-center space-x-3">
                {actions && <div className="flex items-center space-x-2">{actions}</div>}
                <ProfileDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Flow */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full px-6 sm:px-8 py-8 bg-[#ffffff]">
          {children}
        </main>
      </div>
    </div>
  );
}