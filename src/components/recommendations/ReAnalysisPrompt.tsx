import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, TrendingUp } from "lucide-react";

interface ReAnalysisPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onSkip: () => void;
  completedCount: number;
}

export function ReAnalysisPrompt({
  open,
  onOpenChange,
  onConfirm,
  onSkip,
  completedCount,
}: ReAnalysisPromptProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Great Progress! 🎉
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-3">
            <p>
              You've completed {completedCount} recommendation{completedCount > 1 ? 's' : ''}! 
              Your skills have likely improved.
            </p>
            <p className="font-medium text-foreground">
              Would you like to re-run your gap analysis to see your updated match score?
            </p>
            <p className="text-sm text-muted-foreground">
              This will recalculate how well your capabilities align with your dream job requirements.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onSkip} className="sm:flex-1">
            Maybe Later
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="sm:flex-1 gap-2">
            <RefreshCw className="h-4 w-4" />
            Re-run Analysis
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
