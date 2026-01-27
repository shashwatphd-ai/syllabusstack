import {
  LayoutDashboard,
  GraduationCap,
  Briefcase,
  School,
  Shield,
  User,
  BarChart3,
  CreditCard,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  mobileLabel?: string; // Shorter label for mobile
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
  requiresRole?: 'instructor' | 'admin';
}

// Main navigation - always visible
export const mainNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, mobileLabel: 'Home' },
  { name: 'My Learning', href: '/learn', icon: GraduationCap, mobileLabel: 'Learn' },
  { name: 'Career Path', href: '/career', icon: Briefcase, mobileLabel: 'Career' },
  { name: 'Teach', href: '/teach', icon: School, mobileLabel: 'Teach' },
];

// Role-specific navigation
export const instructorNavigation: NavItem[] = [
  { name: 'Instructor Portal', href: '/instructor/courses', icon: School, mobileLabel: 'Instructor' },
];

export const adminNavigation: NavItem[] = [
  { name: 'Admin Portal', href: '/admin', icon: Shield, mobileLabel: 'Admin' },
];

// Secondary navigation (profile, settings, etc.)
export const secondaryNavigation: NavItem[] = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'AI Usage', href: '/usage', icon: BarChart3, mobileLabel: 'Usage' },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Helper to check if a path is active
export function isPathActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) return true;
  if (itemPath !== '/' && currentPath.startsWith(itemPath + '/')) return true;
  return false;
}

// Build complete navigation based on user roles
export function buildNavigation(roles: { role: string }[] = []): NavSection[] {
  const isInstructor = roles.some(r => r.role === 'instructor' || r.role === 'admin');
  const isAdmin = roles.some(r => r.role === 'admin');

  const sections: NavSection[] = [
    { id: 'main', items: mainNavigation },
  ];

  if (isInstructor) {
    sections.push({
      id: 'instructor',
      label: 'Instructor',
      items: instructorNavigation,
      requiresRole: 'instructor',
    });
  }

  if (isAdmin) {
    sections.push({
      id: 'admin',
      label: 'Admin',
      items: adminNavigation,
      requiresRole: 'admin',
    });
  }

  sections.push({
    id: 'secondary',
    items: secondaryNavigation,
  });

  return sections;
}
