import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalPage() {
  useSEO({
    title: "Legal",
    description: "SyllabusStack legal information: privacy, terms, and cookie policy.",
    canonical: "/legal",
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Legal</h1>
          <p className="mt-2 text-muted-foreground">
            Plain-English summaries for now. Replace with your finalized legal text before production.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        </header>

        <section id="privacy" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                We collect account details and the content you submit (e.g., syllabus text) to generate analysis.
              </p>
              <p>
                Your coursework and analyses are private by default and should only be accessible to your account.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="terms" className="mt-6 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Terms of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                SyllabusStack provides informational guidance, not guarantees of employment outcomes.
              </p>
              <p>
                You are responsible for ensuring content you upload is allowed to be shared for analysis.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="cookies" className="mt-6 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Cookie Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                We use essential cookies/local storage for sign-in state and product functionality.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
