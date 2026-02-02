import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Bell, 
  Search,
  User,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { GlobalSearchResults } from '@/components/search/GlobalSearchResults';
import { useUserRoles } from '@/hooks/useUserRoles';
import { NotificationBell } from '@/components/common/NotificationBell';
import { 
  mainNavigation, 
  secondaryNavigation, 
  instructorNavigation, 
  adminNavigation,
  isPathActive 
} from '@/config/navigation';

interface AppHeaderProps {
  onMenuClick?: () => void;
  showSearch?: boolean;
  sidebarCollapsed?: boolean;
}

export function AppHeader({ onMenuClick, showSearch = true, sidebarCollapsed = false }: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { query, setQuery, results, isLoading, clearSearch } = useGlobalSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Open popover when there's a query
  useEffect(() => {
    if (query.length >= 2) {
      setPopoverOpen(true);
    }
  }, [query]);

  const handleSearchSelect = () => {
    setPopoverOpen(false);
    setSearchOpen(false);
    clearSearch();
  };

  // Get current page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/courses')) return 'My Courses';
    if (path.startsWith('/dream-jobs')) return 'Dream Jobs';
    if (path.startsWith('/analysis')) return 'Gap Analysis';
    if (path.startsWith('/recommendations')) return 'Recommendations';
    if (path.startsWith('/billing')) return 'Billing';
    if (path.startsWith('/usage')) return 'AI Usage';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/profile')) return 'Profile';
    if (path.startsWith('/learn')) return 'My Learning';
    if (path.startsWith('/instructor')) return 'Instructor Portal';
    if (path.startsWith('/admin')) return 'Admin';
    if (path.startsWith('/career')) return 'Career Path';
    return 'SyllabusStack';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left side - Menu button and title */}
        <div className="flex items-center gap-3">
          {/* Menu button - mobile only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden min-h-11 min-w-11"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Branding - mobile only (sidebar has logo on desktop) */}
          <Link to="/" className="lg:hidden">
            <Logo size="sm" variant="dark" />
          </Link>
          
          {/* Page title */}
          <h1 className="text-lg font-semibold text-foreground truncate max-w-[150px] sm:max-w-none">
            {getPageTitle()}
          </h1>
        </div>

        {/* Center - Search (desktop) */}
        {showSearch && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <div className="hidden md:flex flex-1 max-w-md mx-4">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Search courses, jobs, recommendations..."
                    className="pl-10 bg-muted/50"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setPopoverOpen(true)}
                  />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start" sideOffset={8}>
              <GlobalSearchResults
                results={results}
                isLoading={isLoading}
                onSelect={handleSearchSelect}
                query={query}
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile search toggle */}
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(!searchOpen)}
              className="md:hidden min-h-11 min-w-11"
              aria-label={searchOpen ? "Close search" : "Open search"}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
          )}

          {/* Notifications */}
          <NotificationBell className="min-h-11 min-w-11" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full min-h-11 min-w-11" aria-label="User menu">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{profile?.full_name || 'Student User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || 'No email'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile search bar */}
      {showSearch && searchOpen && (
        <div className="md:hidden px-4 pb-4 border-b border-border bg-background space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-10"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query.length >= 2 && (
            <div className="bg-background border rounded-md shadow-md">
              <GlobalSearchResults
                results={results}
                isLoading={isLoading}
                onSelect={handleSearchSelect}
                query={query}
              />
            </div>
          )}
        </div>
      )}
    </header>
  );
}

// Mobile navigation drawer - UNIFIED with Sidebar navigation
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { data: roles } = useUserRoles();
  
  const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');
  const isAdmin = roles?.some(r => r.role === 'admin');

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
          <Logo size="sm" variant="dark" />
        </div>

        {/* Navigation - scrollable */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* Main navigation */}
          {mainNavigation.map((item) => {
            const isActive = isPathActive(location.pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-base font-medium min-h-11",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.mobileLabel || item.name}
              </Link>
            );
          })}

          {/* Instructor Section */}
          {isInstructor && (
            <>
              <div className="my-4 pt-4 border-t border-border">
                <p className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Instructor
                </p>
              </div>
              {instructorNavigation.map((item) => {
                const isActive = isPathActive(location.pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-base font-medium min-h-11",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.mobileLabel || item.name}
                  </Link>
                );
              })}
            </>
          )}

          {/* Admin Section */}
          {isAdmin && (
            <>
              <div className="my-4 pt-4 border-t border-border">
                <p className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {adminNavigation.map((item) => {
                const isActive = isPathActive(location.pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-base font-medium min-h-11",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.mobileLabel || item.name}
                  </Link>
                );
              })}
            </>
          )}
          
          {/* Divider */}
          <div className="my-4 border-t border-border" />
          
          {/* Secondary navigation - ALL items now */}
          {secondaryNavigation.map((item) => {
            const isActive = isPathActive(location.pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm min-h-11",
                  isActive 
                    ? "bg-muted text-foreground font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.mobileLabel || item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section - fixed at bottom */}
        <div className="p-4 border-t border-border shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.full_name || 'Student'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'student@university.edu'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="shrink-0 min-h-11 min-w-11 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
