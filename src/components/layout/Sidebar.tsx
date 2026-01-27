import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/Logo';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { 
  mainNavigation, 
  secondaryNavigation, 
  instructorNavigation, 
  adminNavigation,
  isPathActive,
  type NavItem 
} from '@/config/navigation';

interface SidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapse }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { data: roles } = useUserRoles();
  
  // Use the controlled collapsed prop directly - no internal state needed
  const isCollapsed = collapsed;
  
  const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');
  const isAdmin = roles?.some(r => r.role === 'admin');

  const handleCollapse = () => {
    onCollapse?.(!collapsed);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const NavItem = ({ item }: { item: NavItem }) => {
    const isActive = isPathActive(location.pathname, item.href);
    const Icon = item.icon;
    
    const content = (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          "hover:bg-sidebar-accent",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground opacity-80"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 flex-shrink-0",
            isActive ? "text-sidebar-primary" : ""
          )}
        />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside 
      className={cn(
        "h-screen flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "h-16 flex items-center border-b border-sidebar-border px-4",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        <Link to="/dashboard" className="flex items-center">
          <Logo 
            size="sm" 
            showText={!isCollapsed} 
            showIcon={true}
            variant="auto"
          />
        </Link>
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCollapse}
            className="text-sidebar-foreground opacity-70 hover:opacity-100 hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collapse button when collapsed */}
      {isCollapsed && (
        <div className="px-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCollapse}
            className="w-full text-sidebar-foreground opacity-70 hover:opacity-100 hover:bg-sidebar-accent"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {mainNavigation.map((item) => (
          <NavItem key={item.name} item={item} />
        ))}

        {/* Instructor Section */}
        {isInstructor && (
          <>
            {!isCollapsed && (
              <div className="pt-4 mt-4 border-t border-sidebar-border">
                <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground opacity-60 uppercase tracking-wider">
                  Instructor
                </p>
              </div>
            )}
            {instructorNavigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <>
            {!isCollapsed && (
              <div className="pt-4 mt-4 border-t border-sidebar-border">
                <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground opacity-60 uppercase tracking-wider">
                  Admin
                </p>
              </div>
            )}
            {adminNavigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Secondary Navigation */}
      <div className="px-2 py-4 border-t border-sidebar-border space-y-1">
        {secondaryNavigation.map((item) => (
          <NavItem key={item.name} item={item} />
        ))}
      </div>

      {/* User Section */}
      <div className={cn(
        "p-4 border-t border-sidebar-border",
        isCollapsed && "px-2"
      )}>
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed && "justify-center"
        )}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <User className="h-4 w-4 text-sidebar-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'Student'}
              </p>
              <p className="text-xs text-sidebar-foreground opacity-70 truncate">
                {user?.email || 'student@university.edu'}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-sidebar-foreground opacity-70 hover:opacity-100 hover:bg-sidebar-accent"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Sign out
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}
