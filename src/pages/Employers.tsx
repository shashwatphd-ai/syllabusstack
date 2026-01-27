import { Link } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  Zap,
  Lock,
  Code2,
  Building2,
  ArrowRight,
  Clock,
  BarChart3,
  Users,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Shield,
    title: 'Verified Credentials',
    description: 'Every certificate includes identity verification, ensuring candidates are who they claim to be.',
  },
  {
    icon: BarChart3,
    title: 'Mastery Scores',
    description: 'See actual competency levels with detailed skill breakdowns, not just pass/fail.',
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
];

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'For small teams getting started',
    features: [
      '50 verifications/month',
      'Web portal access',
      'Basic API access',
      'Email support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'For growing companies',
    features: [
      '500 verifications/month',
      'Full API access',
      'Webhook notifications',
      'Bulk verification',
      'Priority support',
      'Usage analytics',
    ],
    cta: 'Start Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations',
    features: [
      'Unlimited verifications',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'SSO support',
      'On-premise option',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const stats = [
  { value: '50K+', label: 'Certificates Issued' },
  { value: '99.9%', label: 'API Uptime' },
  { value: '<100ms', label: 'Avg Response Time' },
  { value: '500+', label: 'Employers Trust Us' },
];

export default function EmployersPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <span className="font-semibold text-lg">SyllabusStack</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <Button asChild>
              <Link to="/auth?tab=signup&type=employer">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
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
              <Link to="/auth?tab=signup&type=employer">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="#pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
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
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Candidate Shares Certificate</h3>
              <p className="text-sm text-muted-foreground">
                Candidates provide their certificate number or share link during the application process.
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">You Verify via API</h3>
              <p className="text-sm text-muted-foreground">
                Call our API with the certificate ID. Get instant verification with full credential details.
              </p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Make Informed Decisions</h3>
              <p className="text-sm text-muted-foreground">
                Review mastery scores, skill breakdowns, and identity verification status before hiring.
              </p>
            </div>
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
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">OpenAPI specification available</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">SDKs for Python, JavaScript, Go</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">Webhook notifications for real-time updates</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">Sandbox environment for testing</span>
                </li>
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">
              Start free, scale as you grow. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.highlighted ? 'border-primary border-2 shadow-lg' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    asChild
                  >
                    <Link to={plan.name === 'Enterprise' ? '/contact' : '/auth?tab=signup&type=employer'}>
                      {plan.cta}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Verify Credentials?</h2>
          <p className="text-muted-foreground mb-8">
            Join hundreds of employers who trust SyllabusStack for credential verification.
            Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/auth?tab=signup&type=employer">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/employer">
                <Users className="mr-2 h-4 w-4" />
                Employer Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} SyllabusStack. All rights reserved.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/legal" className="hover:text-foreground">Privacy</Link>
            <Link to="/legal" className="hover:text-foreground">Terms</Link>
            <Link to="/resources" className="hover:text-foreground">Documentation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
