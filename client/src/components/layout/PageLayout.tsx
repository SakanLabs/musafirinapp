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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 lg:ml-0 ml-12">
                {showBackButton && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="p-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                  {subtitle && (
                    <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {actions}
                <ProfileDropdown />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}