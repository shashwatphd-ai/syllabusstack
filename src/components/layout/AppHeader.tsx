import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Bell, 
  Search,
  User,
  Settings,
  LogOut,
  GraduationCap,
  X
} from 'lucide-react';
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

interface AppHeaderProps {
  onMenuClick?: () => void;
  showSearch?: boolean;
}

export function AppHeader({ onMenuClick, showSearch = true }: AppHeaderProps) {
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
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/profile')) return 'Profile';
    return 'EduThree';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left side - Menu button and title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <h1 className="text-lg font-semibold text-foreground hidden sm:block">
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
              className="md:hidden"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
          )}

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
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

// Mobile navigation drawer
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'My Courses', href: '/courses' },
    { name: 'Dream Jobs', href: '/dream-jobs' },
    { name: 'Gap Analysis', href: '/analysis' },
    { name: 'Recommendations', href: '/recommendations' },
    { name: 'Profile', href: '/profile' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-72 p-0">
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">EduThree</span>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "block px-4 py-2.5 rounded-lg transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-foreground hover:bg-muted"
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
