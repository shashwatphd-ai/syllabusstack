import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResourcesPage() {
  useSEO({
    title: "Resources",
    description: "SyllabusStack resources: documentation, career guides, product updates, and support.",
    canonical: "/resources",
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Resources</h1>
          <p className="mt-2 text-muted-foreground">
            Quick links to help you get the most out of SyllabusStack.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </header>

        <section id="documentation" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Documentation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Product docs will live here (setup, scanning, interpreting gap analyses, and exporting results).
            </CardContent>
          </Card>
        </section>

        <section id="career-guides" className="mt-6 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Career Guides</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Short playbooks for common roles (PM, analyst, data, finance) and what “job-ready” actually means.
            </CardContent>
          </Card>
        </section>

        <section id="blog" className="mt-6 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Blog</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Product updates and deep dives into the reasoning behind the analysis.
            </CardContent>
          </Card>
        </section>

        <section id="support" className="mt-6 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle>Support</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Need help? Email us at{" "}
              <a className="underline" href="mailto:support@syllabusstack.com">support@syllabusstack.com</a>.
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
