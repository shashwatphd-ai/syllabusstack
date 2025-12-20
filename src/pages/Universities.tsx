import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UniversitiesPage() {
  useSEO({
    title: "For Universities",
    description: "EduThree for universities: curriculum-to-career alignment and cohort insights.",
    canonical: "/universities",
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">EduThree for Universities</h1>
          <p className="mt-2 text-muted-foreground">
            Understand what students actually learn—and how it maps to real job requirements.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
            <Button asChild>
              <a href="mailto:partnerships@eduthree.app">Contact partnerships</a>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Curriculum → Capability</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Convert syllabi into concrete, comparable capabilities across courses and programs.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Career Alignment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Benchmark programs against target roles and highlight where learners are likely to fall short.
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
