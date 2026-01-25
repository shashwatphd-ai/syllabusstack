import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserCheck, UserX } from "lucide-react";

interface IdentityVerificationBadgeProps {
  isVerified: boolean;
  size?: "sm" | "md";
}

export function IdentityVerificationBadge({
  isVerified,
  size = "md",
}: IdentityVerificationBadgeProps) {
  if (!isVerified) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1">
            <UserX className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {size === "md" && "Not Verified"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Identity not verified</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <UserCheck className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
          {size === "md" && "ID Verified"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>Identity verified via government ID</p>
      </TooltipContent>
    </Tooltip>
  );
}
