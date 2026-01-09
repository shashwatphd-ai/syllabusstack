import { Receipt, Download, ExternalLink, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  created_at: string;
  pdf_url?: string;
  hosted_url?: string;
  description?: string;
}

export function BillingHistory() {
  const { user } = useAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase.functions.invoke('get-invoices', {
        body: {},
      });

      if (error) throw error;
      return data?.invoices || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Billing History
        </CardTitle>
        <CardDescription>
          View and download your past invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!invoices || invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No invoices yet</p>
            <p className="text-sm">Your billing history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const statusConfig = {
    paid: {
      icon: CheckCircle,
      label: 'Paid',
      className: 'text-success',
      badgeVariant: 'default' as const,
    },
    open: {
      icon: Clock,
      label: 'Pending',
      className: 'text-warning',
      badgeVariant: 'secondary' as const,
    },
    void: {
      icon: XCircle,
      label: 'Void',
      className: 'text-muted-foreground',
      badgeVariant: 'outline' as const,
    },
    uncollectible: {
      icon: XCircle,
      label: 'Failed',
      className: 'text-destructive',
      badgeVariant: 'destructive' as const,
    },
  };

  const status = statusConfig[invoice.status] || statusConfig.open;
  const StatusIcon = status.icon;

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleDownload = async () => {
    if (!invoice.pdf_url) return;
    setIsDownloading(true);
    try {
      window.open(invoice.pdf_url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn("p-2 rounded-full bg-muted", status.className)}>
          <StatusIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{invoice.number || `Invoice #${invoice.id.slice(-8)}`}</p>
            <Badge variant={status.badgeVariant} className="text-xs">
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(invoice.created_at), 'MMMM d, yyyy')}
            {invoice.description && ` • ${invoice.description}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="font-semibold">
          {formatAmount(invoice.amount, invoice.currency)}
        </p>
        <div className="flex gap-1">
          {invoice.pdf_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          )}
          {invoice.hosted_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(invoice.hosted_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for dashboard
export function RecentInvoices({ limit = 3 }: { limit?: number }) {
  const { user } = useAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', user?.id, 'recent'],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase.functions.invoke('get-invoices', {
        body: { limit },
      });

      if (error) throw error;
      return data?.invoices || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!invoices || invoices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Recent Invoices</p>
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-center justify-between py-2 text-sm"
        >
          <span>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
          <span className="font-medium">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: invoice.currency.toUpperCase(),
            }).format(invoice.amount / 100)}
          </span>
        </div>
      ))}
    </div>
  );
}
