import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const productType = searchParams.get("type") || "payment";
  const courseId = searchParams.get("course");
  const certificateId = searchParams.get("certificate");

  useEffect(() => {
    // Clear the URL params after displaying
    const timer = setTimeout(() => {
      window.history.replaceState({}, "", "/payment-success");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const getContent = () => {
    switch (productType) {
      case "enrollment":
        return {
          title: "Successfully Enrolled!",
          description: "You now have full access to this course.",
          icon: CheckCircle2,
          actions: (
            <>
              <Button onClick={() => navigate(courseId ? `/learn/course/${courseId}` : "/learn")} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Start Learning
              </Button>
              <Button variant="outline" onClick={() => navigate("/learn")}>
                View All Courses
              </Button>
            </>
          ),
          nextSteps: [
            "Begin with the first learning objective",
            "Watch the video content and complete micro-checks",
            "Pass assessments to verify your mastery",
            "Earn your certificate upon completion",
          ],
        };
      case "certificate":
        return {
          title: "Certificate Purchased!",
          description: "Your verified credential is being generated.",
          icon: CheckCircle2,
          actions: (
            <>
              <Button onClick={() => navigate(certificateId ? `/certificate/${certificateId}` : "/learn")} className="gap-2">
                <Download className="h-4 w-4" />
                View Certificate
              </Button>
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share on LinkedIn
              </Button>
            </>
          ),
          nextSteps: [
            "Download your PDF certificate",
            "Share your achievement on social media",
            "Add to your LinkedIn profile",
            "Employers can verify via QR code",
          ],
        };
      case "course_creation":
        return {
          title: "Course Creation Unlocked!",
          description: "You can now create and publish your course.",
          icon: CheckCircle2,
          actions: (
            <>
              <Button onClick={() => navigate("/instructor/quick-setup")} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Continue Setup
              </Button>
              <Button variant="outline" onClick={() => navigate("/instructor/courses")}>
                View My Courses
              </Button>
            </>
          ),
          nextSteps: [
            "Upload your syllabus to generate structure",
            "Review and customize learning objectives",
            "AI will generate slide content automatically",
            "Share access code with your students",
          ],
        };
      default:
        return {
          title: "Payment Successful!",
          description: "Thank you for your purchase.",
          icon: CheckCircle2,
          actions: (
            <Button onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              Go to Dashboard
            </Button>
          ),
          nextSteps: [],
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <AppShell>
      <div className="container max-w-2xl py-16">
        <Card className="text-center">
          <CardHeader className="pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <Icon className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{content.title}</CardTitle>
            <CardDescription className="text-lg">{content.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {content.actions}
            </div>

            {content.nextSteps.length > 0 && (
              <div className="pt-6 border-t">
                <h3 className="font-semibold mb-4 text-left">What's Next?</h3>
                <ol className="space-y-3 text-left">
                  {content.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
