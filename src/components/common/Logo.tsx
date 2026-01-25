import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark" | "auto";
  showText?: boolean;
  className?: string;
}

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ size = "md", variant = "auto", showText = true, className }, ref) => {
    const sizes = {
      sm: { icon: "w-7 h-7", text: "text-lg", bars: "h-1" },
      md: { icon: "w-9 h-9", text: "text-xl", bars: "h-1.5" },
      lg: { icon: "w-12 h-12", text: "text-2xl", bars: "h-2" },
    };

    const textColor = {
      light: "text-primary-foreground",
      dark: "text-foreground",
      auto: "text-foreground dark:text-primary-foreground",
    };

    const accentColor = {
      light: "text-coral-400",
      dark: "text-coral-500",
      auto: "text-coral-500 dark:text-coral-400",
    };

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)}>
        {/* Icon - Stacked layers representing syllabi/courses */}
        <div className={cn(
          "relative flex flex-col justify-center items-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-500 shadow-lg shadow-coral-500/25",
          sizes[size].icon
        )}>
          {/* Three stacked horizontal bars representing layers */}
          <div className="flex flex-col gap-0.5 w-3/5">
            <div className={cn("w-full bg-white/90 rounded-full", sizes[size].bars)} />
            <div className={cn("w-4/5 bg-white/70 rounded-full", sizes[size].bars)} />
            <div className={cn("w-3/5 bg-white/50 rounded-full", sizes[size].bars)} />
          </div>
        </div>

        {/* Text logo */}
        {showText && (
          <span className={cn("font-bold tracking-tight", sizes[size].text, textColor[variant])}>
            Syllabus<span className={accentColor[variant]}>Stack</span>
          </span>
        )}
      </div>
    );
  }
);

Logo.displayName = "Logo";
