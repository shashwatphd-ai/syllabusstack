import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import logoImage from "@/assets/syllabusstack-logo.svg";
import faviconIcon from "@/assets/syllabusstack-icon.svg";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  showIcon?: boolean;
  className?: string;
}

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ size = "md", variant = "auto", showText = true, showIcon = true, className }, ref) => {
    const sizes = {
      sm: { icon: "h-8", text: "text-lg", full: "h-8" },
      md: { icon: "h-10", text: "text-xl", full: "h-10" },
      lg: { icon: "h-12", text: "text-2xl", full: "h-12" },
      xl: { icon: "h-16", text: "text-3xl", full: "h-16" },
    };

    const textColor = {
      light: "text-white",
      dark: "text-indigo-900",
      auto: "text-indigo-900 dark:text-white",
    };

    const accentColor = {
      light: "text-amber-400",
      dark: "text-amber-500",
      auto: "text-amber-500 dark:text-amber-400",
    };

    // If showing both icon and text, use the full logo image
    if (showIcon && showText) {
      return (
        <div ref={ref} className={cn("flex items-center", className)}>
          <img 
            src={logoImage} 
            alt="SyllabusStack" 
            className={cn("object-contain", sizes[size].full)}
          />
        </div>
      );
    }

    // Icon only mode - use the dedicated icon SVG
    if (showIcon && !showText) {
      return (
        <div ref={ref} className={cn("flex items-center", className)}>
          <img
            src={faviconIcon}
            alt="SyllabusStack"
            className={cn("object-contain", sizes[size].icon)}
          />
        </div>
      );
    }

    // Text only mode
    return (
      <div ref={ref} className={cn("flex items-center", className)}>
        <span className={cn("font-bold tracking-tight", sizes[size].text, textColor[variant])}>
          Syllabus<span className={accentColor[variant]}>Stack</span>
        </span>
      </div>
    );
  }
);

Logo.displayName = "Logo";
