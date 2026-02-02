import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  showIcon?: boolean;
  className?: string;
}

// Icon component that renders the 3D stacked box with S
const LogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 50 55" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Bottom box layer */}
    <path d="M10 44 L25 52 L40 44 L40 38 L25 46 L10 38 Z" fill="#E89A3C"/>
    <path d="M25 46 L25 52 L40 44 L40 38 Z" fill="#D4872F"/>
    {/* Middle box layer */}
    <path d="M10 32 L25 40 L40 32 L40 26 L25 34 L10 26 Z" fill="#E89A3C"/>
    <path d="M25 34 L25 40 L40 32 L40 26 Z" fill="#D4872F"/>
    {/* Top box layer */}
    <path d="M10 20 L25 28 L40 20 L40 14 L25 22 L10 14 Z" fill="#E89A3C"/>
    <path d="M25 22 L25 28 L40 20 L40 14 Z" fill="#D4872F"/>
    {/* Top surface */}
    <path d="M10 14 L25 22 L40 14 L25 6 Z" fill="#F5A742"/>
    {/* Purple S shape */}
    <path d="M14 10 L14 18 L22 22 L22 28 L14 24 L14 32 L30 40 L30 32 L22 28 L22 22 L30 26 L30 18 Z" fill="#4A3660"/>
  </svg>
);

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ size = "md", variant = "auto", showText = true, showIcon = true, className }, ref) => {
    const sizes = {
      sm: { icon: "h-7 w-7", text: "text-lg", gap: "gap-2" },
      md: { icon: "h-9 w-9", text: "text-xl", gap: "gap-2" },
      lg: { icon: "h-11 w-11", text: "text-2xl", gap: "gap-3" },
      xl: { icon: "h-14 w-14", text: "text-3xl", gap: "gap-3" },
    };

    const textColors = {
      light: "text-white",
      dark: "text-indigo-900",
      auto: "text-indigo-900 dark:text-white",
    };

    const accentColors = {
      light: "text-amber-400",
      dark: "text-amber-500",
      auto: "text-amber-500 dark:text-amber-400",
    };

    // Icon only mode
    if (showIcon && !showText) {
      return (
        <div ref={ref} className={cn("flex items-center", className)}>
          <LogoIcon className={sizes[size].icon} />
        </div>
      );
    }

    // Text only mode
    if (!showIcon && showText) {
      return (
        <div ref={ref} className={cn("flex items-center", className)}>
          <span className={cn("font-bold tracking-tight", sizes[size].text, textColors[variant])}>
            Syllabus<span className={accentColors[variant]}>Stack</span>
          </span>
        </div>
      );
    }

    // Full logo: Icon + Text
    return (
      <div ref={ref} className={cn("flex items-center", sizes[size].gap, className)}>
        <LogoIcon className={sizes[size].icon} />
        <span className={cn("font-bold tracking-tight", sizes[size].text, textColors[variant])}>
          Syllabus<span className={accentColors[variant]}>Stack</span>
        </span>
      </div>
    );
  }
);

Logo.displayName = "Logo";
