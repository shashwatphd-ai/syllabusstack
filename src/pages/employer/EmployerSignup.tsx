import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateEmployerAccount } from '@/hooks/useEmployerAccount';
import { useToast } from '@/hooks/use-toast';

const industries = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Education',
  'Retail & E-commerce',
  'Manufacturing',
  'Consulting',
  'Government',
  'Non-profit',
  'Other',
];

const companySizes = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1001+', label: '1000+ employees' },
];

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    description: '50 verifications/month',
    features: ['Web portal access', 'Basic API', 'Email support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$99/mo',
    description: '500 verifications/month',
    features: ['Full API access', 'Webhooks', 'Priority support'],
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'Unlimited verifications',
    features: ['Dedicated support', 'SLA guarantee', 'Custom integrations'],
  },
];

type Step = 'company' | 'plan' | 'complete';

interface CompanyData {
  company_name: string;
  company_domain: string;
  industry: string;
  company_size: string;
  contact_name: string;
  contact_email: string;
}

export default function EmployerSignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createAccount = useCreateEmployerAccount();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('company');
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [companyData, setCompanyData] = useState<CompanyData>({
    company_name: '',
    company_domain: '',
    industry: '',
    company_size: '',
    contact_name: '',
    contact_email: user?.email || '',
  });

  const handleCompanySubmit = () => {
    if (!companyData.company_name.trim()) {
      toast({
        title: 'Company name required',
        description: 'Please enter your company name.',
        variant: 'destructive',
      });
      return;
    }
    setStep('plan');
  };

  const handlePlanSubmit = async () => {
    try {
      await createAccount.mutateAsync({
        company_name: companyData.company_name,
        company_domain: companyData.company_domain || undefined,
      });
      setStep('complete');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleComplete = () => {
    navigate('/employer');
  };

  // If not authenticated, redirect to auth
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Please sign in or create an account to set up your employer portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link to="/auth?tab=signup&type=employer">Create Account</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{' '}
              <Link to="/auth" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['company', 'plan', 'complete'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : step === 'complete' || (step === 'plan' && s === 'company')
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step === 'complete' || (step === 'plan' && s === 'company') ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={`w-16 h-0.5 mx-2 ${
                    (step === 'plan' && i === 0) || step === 'complete'
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Company Information */}
        {step === 'company' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Tell us about your company to set up your employer account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  placeholder="Acme Inc."
                  value={companyData.company_name}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, company_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_domain">Company Website</Label>
                <Input
                  id="company_domain"
                  placeholder="acme.com"
                  value={companyData.company_domain}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, company_domain: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={companyData.industry}
                    onValueChange={(value) =>
                      setCompanyData({ ...companyData, industry: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_size">Company Size</Label>
                  <Select
                    value={companyData.company_size}
                    onValueChange={(value) =>
                      setCompanyData({ ...companyData, company_size: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Your Name</Label>
                <Input
                  id="contact_name"
                  placeholder="John Smith"
                  value={companyData.contact_name}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, contact_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="john@acme.com"
                  value={companyData.contact_email}
                  onChange={(e) =>
                    setCompanyData({ ...companyData, contact_email: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" asChild>
                  <Link to="/employers">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <Button onClick={handleCompanySubmit}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Plan Selection */}
        {step === 'plan' && (
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Plan</CardTitle>
              <CardDescription>
                Select a plan that fits your verification needs. You can upgrade anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative flex items-start space-x-4 rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedPlan === plan.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={plan.id} className="font-semibold cursor-pointer">
                          {plan.name}
                        </Label>
                        {plan.recommended && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-bold">{plan.price}</div>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((feature) => (
                          <li key={feature} className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep('company')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handlePlanSubmit} disabled={createAccount.isPending}>
                  {createAccount.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <Card>
            <CardHeader className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Welcome to SyllabusStack!</CardTitle>
              <CardDescription>
                Your employer account has been created successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Next Steps:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium shrink-0">
                      1
                    </span>
                    <span>Generate your first API key in the dashboard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium shrink-0">
                      2
                    </span>
                    <span>Review the API documentation for integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium shrink-0">
                      3
                    </span>
                    <span>Verify your first certificate using the sandbox</span>
                  </li>
                </ul>
              </div>

              <Button className="w-full" size="lg" onClick={handleComplete}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
