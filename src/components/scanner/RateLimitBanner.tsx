import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RateLimitBannerProps {
  remaining: number;
}

export function RateLimitBanner({ remaining }: RateLimitBannerProps) {
  if (remaining > 2 || remaining <= 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-yellow-500/50 bg-yellow-50/10">
      <CardContent className="py-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <div className="flex-1">
          <p className="text-sm font-medium">Only {remaining} free scan{remaining !== 1 ? 's' : ''} left</p>
          <p className="text-xs text-muted-foreground">Sign up for unlimited scans and full analysis</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/auth">Sign Up</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
