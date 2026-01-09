import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AppShell } from "@/components/layout";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CheckoutTier = "pro";

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"starting" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tier = (params.get("tier") || "pro") as CheckoutTier;
  const isAnnual = params.get("isAnnual") === "1" || params.get("isAnnual") === "true";

  const returnTo = useMemo(() => {
    const rt = params.get("returnTo");
    if (rt && rt.startsWith("/")) return rt;
    return "/billing#pricing";
  }, [params]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            tier,
            isAnnual,
            successUrl: `${window.location.origin}/billing?success=true`,
            cancelUrl: `${window.location.origin}/billing?canceled=true`,
          },
        });

        if (error) throw error;
        if (!data?.url) throw new Error("Checkout URL missing");
        if (cancelled) return;

        // Full redirect in the new tab (avoids iframe navigation restrictions)
        window.location.replace(data.url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to start checkout";
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(msg);
        toast({ title: "Checkout failed", description: msg, variant: "destructive" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tier, isAnnual]);

  return (
    <AppShell>
      <PageContainer maxWidth="md">
        <PageHeader
          title="Redirecting to checkout"
          description="One moment — opening the secure payment page."
        />

        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-4">
            {status === "starting" ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  If nothing happens, your browser may be blocking popups. Go back and try again.
                </p>
                <Button variant="outline" onClick={() => navigate(returnTo)}>
                  Back to Billing
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  {errorMsg ?? "Unable to start checkout."}
                </p>
                <Button asChild>
                  <Link to={returnTo}>Back to Billing</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
