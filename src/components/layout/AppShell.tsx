import { forwardRef, useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { AppHeader, MobileNav } from './AppHeader';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  showSearch?: boolean;
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  function AppShell({ children, showSearch = true }, ref) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
      <div ref={ref} className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:top-0 lg:z-50 lg:flex">
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onCollapse={setSidebarCollapsed} 
          />
        </div>

        {/* Mobile Nav */}
        <MobileNav 
          open={mobileNavOpen} 
          onClose={() => setMobileNavOpen(false)} 
        />

        {/* Main content */}
        <div className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}>
          <AppHeader 
            onMenuClick={() => setMobileNavOpen(true)}
            showSearch={showSearch}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    );
  }
);
