import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout";

export default function PaymentCancel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const productType = searchParams.get("type") || "payment";
  const returnUrl = searchParams.get("return");

  const getContent = () => {
    switch (productType) {
      case "enrollment":
        return {
          title: "Enrollment Cancelled",
          description: "No charges were made to your account.",
          returnAction: {
            label: "Try Again",
            path: "/learn",
          },
        };
      case "certificate":
        return {
          title: "Certificate Purchase Cancelled",
          description: "You can still complete the course and purchase a certificate later.",
          returnAction: {
            label: "Back to Course",
            path: returnUrl || "/learn",
          },
        };
      case "course_creation":
        return {
          title: "Course Creation Cancelled",
          description: "Upgrade to Pro for unlimited course creation, or pay $1 per course.",
          returnAction: {
            label: "View Plans",
            path: "/billing",
          },
        };
      default:
        return {
          title: "Payment Cancelled",
          description: "No charges were made. You can try again anytime.",
          returnAction: {
            label: "Go Back",
            path: "/dashboard",
          },
        };
    }
  };

  const content = getContent();

  return (
    <AppShell>
      <div className="container max-w-2xl py-16">
        <Card className="text-center">
          <CardHeader className="pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-muted">
              <XCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">{content.title}</CardTitle>
            <CardDescription className="text-lg">{content.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate(content.returnAction.path)} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {content.returnAction.label}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </div>

            <div className="pt-6 border-t">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span>Need help? Contact support@syllabusstack.com</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
