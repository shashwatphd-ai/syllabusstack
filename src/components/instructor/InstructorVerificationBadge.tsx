import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

interface InstructorVerificationBadgeProps {
  isVerified: boolean;
  trustScore?: number;
  showScore?: boolean;
  size?: "sm" | "md";
}

export function InstructorVerificationBadge({
  isVerified,
  trustScore = 0,
  showScore = false,
  size = "md",
}: InstructorVerificationBadgeProps) {
  if (!isVerified) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1">
            <ShieldAlert className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {size === "md" && "Unverified"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This instructor has not been verified</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const getTrustLevel = () => {
    if (trustScore >= 80) return { label: "Highly Trusted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
    if (trustScore >= 60) return { label: "Trusted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" };
    return { label: "Verified", color: "bg-primary/10 text-primary" };
  };

  const { label, color } = getTrustLevel();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`gap-1 ${color}`}>
          <ShieldCheck className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          {size === "md" && (showScore ? `${label} (${trustScore})` : label)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {label} Instructor
          {showScore && ` • Trust Score: ${trustScore}/100`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
