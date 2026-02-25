import { Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  Zap,
  Lock,
  Code2,
  Building2,
  ArrowRight,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

const features = [
  {
    icon: Shield,
    title: 'Verified Credentials',
    description: 'Every certificate includes identity verification, ensuring candidates are who they claim to be.',
  },
  {
    icon: Zap,
    title: 'Instant Verification',
    description: 'Verify certificates in under 100ms via our REST API or web portal.',
  },
  {
    icon: Lock,
    title: 'Tamper-Proof',
    description: 'Cryptographic signatures ensure certificates cannot be forged or modified.',
  },
  {
    icon: Code2,
    title: 'Easy Integration',
    description: 'Simple REST API with SDKs for Python, JavaScript, and Go. Webhook support included.',
  },
  {
    icon: Globe,
    title: 'Bulk Verification',
    description: 'Verify multiple credentials at once during high-volume hiring periods.',
  },
  {
    icon: CheckCircle2,
    title: 'Mastery Scores',
    description: 'See actual competency levels with detailed skill breakdowns, not just pass/fail.',
  },
];

export default function EmployersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge variant="secondary" className="mb-4">
            <Building2 className="h-3 w-3 mr-1" />
            For Employers
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Verify Candidate Credentials
            <br />
            <span className="text-primary">in Seconds</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Stop trusting resumes blindly. Instantly verify course completions,
            mastery scores, and identity-confirmed credentials from SyllabusStack.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="mailto:partnerships@syllabusstack.com">
                Contact Us
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">See Features</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Employers Choose Us</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built for modern hiring workflows with security and speed at the core.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">
              Three simple steps to verify any SyllabusStack credential.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, title: "Candidate Shares Certificate", desc: "Candidates provide their certificate number or share link during the application process." },
              { step: 2, title: "You Verify via API", desc: "Call our API with the certificate ID. Get instant verification with full credential details." },
              { step: 3, title: "Make Informed Decisions", desc: "Review mastery scores, skill breakdowns, and identity verification status before hiring." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Preview */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4">
                <Code2 className="h-3 w-3 mr-1" />
                Developer Friendly
              </Badge>
              <h2 className="text-3xl font-bold mb-4">Simple REST API</h2>
              <p className="text-muted-foreground mb-6">
                Integrate credential verification into your ATS, HRIS, or custom hiring workflow
                with just a few lines of code.
              </p>
              <ul className="space-y-3">
                {[
                  "OpenAPI specification available",
                  "SDKs for Python, JavaScript, Go",
                  "Webhook notifications for real-time updates",
                  "Sandbox environment for testing",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-lg p-6 font-mono text-sm">
              <div className="text-slate-400 mb-2"># Verify a certificate</div>
              <div className="text-green-400">curl</div>
              <div className="text-slate-300 pl-4">-X POST \</div>
              <div className="text-slate-300 pl-4">-H "x-api-key: your_key" \</div>
              <div className="text-slate-300 pl-4">-d '{"{'"}certificate_number": "SS-123456"{'}'}' \</div>
              <div className="text-blue-400 pl-4">https://api.syllabusstack.com/verify</div>
              <div className="mt-4 text-slate-400"># Response</div>
              <pre className="text-yellow-300 text-xs overflow-x-auto">{`{
  "valid": true,
  "certificate": {
    "course_title": "Data Science 101",
    "mastery_score": 87.5,
    "identity_verified": true,
    "skills": ["Python", "Statistics", "ML"]
  }
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Interested in Credential Verification?</h2>
          <p className="text-muted-foreground mb-8">
            We're building the employer verification platform now. Get in touch to learn more
            or join the early access program.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="mailto:partnerships@syllabusstack.com">
                Contact Us
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
