import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const endpoints = [
  {
    method: 'POST',
    path: '/functions/v1/employer-verify-completion',
    title: 'Verify Certificate',
    description: 'Verify a certificate by its number, share token, or ID.',
    requestBody: {
      certificate_number: { type: 'string', description: 'Certificate number (e.g., SS-123456)' },
      share_token: { type: 'string', description: 'Share token from certificate URL (alternative)' },
      certificate_id: { type: 'string', description: 'Certificate UUID (alternative)' },
    },
    responseExample: `{
  "valid": true,
  "certificate": {
    "certificate_number": "SS-123456",
    "certificate_type": "assessed",
    "course_title": "Introduction to Data Science",
    "instructor_name": "Dr. Jane Smith",
    "mastery_score": 87.5,
    "identity_verified": true,
    "completion_date": "2026-01-15",
    "skills": [
      { "skill": "Python", "proficiency": "intermediate" },
      { "skill": "Statistics", "proficiency": "advanced" },
      { "skill": "Machine Learning", "proficiency": "beginner" }
    ]
  }
}`,
    errors: [
      { code: 401, message: 'Invalid or missing API key' },
      { code: 404, message: 'Certificate not found' },
      { code: 429, message: 'Rate limit exceeded' },
    ],
  },
  {
    method: 'GET',
    path: '/functions/v1/employer-verify-completion',
    title: 'Quick Verify',
    description: 'Quick verification using query parameters instead of body.',
    queryParams: {
      certificate_number: { type: 'string', description: 'Certificate number to verify' },
    },
    responseExample: `{
  "valid": true,
  "certificate": {
    "certificate_number": "SS-123456",
    "certificate_type": "completion_badge",
    "course_title": "Web Development Fundamentals",
    "mastery_score": null,
    "identity_verified": false,
    "completion_date": "2026-01-10"
  }
}`,
  },
  {
    method: 'POST',
    path: '/functions/v1/employer-batch-verify',
    title: 'Batch Verify',
    description: 'Verify multiple certificates in a single request.',
    requestBody: {
      certificates: {
        type: 'array',
        description: 'Array of certificate numbers to verify (max 50)',
      },
    },
    responseExample: `{
  "results": [
    {
      "certificate_number": "SS-123456",
      "valid": true,
      "certificate": { ... }
    },
    {
      "certificate_number": "SS-789012",
      "valid": false,
      "error": "Certificate not found"
    }
  ],
  "verified_count": 1,
  "failed_count": 1
}`,
  },
];

const codeExamples = {
  curl: `curl -X POST \\
  https://your-project.supabase.co/functions/v1/employer-verify-completion \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: your_api_key_here" \\
  -d '{"certificate_number": "SS-123456"}'`,
  javascript: `const response = await fetch(
  'https://your-project.supabase.co/functions/v1/employer-verify-completion',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your_api_key_here',
    },
    body: JSON.stringify({
      certificate_number: 'SS-123456',
    }),
  }
);

const data = await response.json();
console.log(data.valid ? 'Valid!' : 'Invalid');`,
  python: `import requests

response = requests.post(
    'https://your-project.supabase.co/functions/v1/employer-verify-completion',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': 'your_api_key_here',
    },
    json={
        'certificate_number': 'SS-123456',
    }
)

data = response.json()
print('Valid!' if data['valid'] else 'Invalid')`,
};

export default function ApiDocsPage() {
  const { toast } = useToast();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: 'Code copied to clipboard' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/employer">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">API Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Everything you need to integrate credential verification into your workflow.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <a href="#authentication" className="block text-sm text-muted-foreground hover:text-foreground">
                  Authentication
                </a>
                <a href="#endpoints" className="block text-sm text-muted-foreground hover:text-foreground">
                  Endpoints
                </a>
                <a href="#examples" className="block text-sm text-muted-foreground hover:text-foreground">
                  Code Examples
                </a>
                <a href="#webhooks" className="block text-sm text-muted-foreground hover:text-foreground">
                  Webhooks
                </a>
                <a href="#errors" className="block text-sm text-muted-foreground hover:text-foreground">
                  Error Handling
                </a>
                <a href="#rate-limits" className="block text-sm text-muted-foreground hover:text-foreground">
                  Rate Limits
                </a>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <p className="text-sm font-medium">Need Help?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact our developer support team at{' '}
                  <a href="mailto:api@syllabusstack.com" className="text-primary hover:underline">
                    api@syllabusstack.com
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Authentication */}
          <section id="authentication">
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>
                  All API requests require authentication using an API key.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Include your API key in the <code className="bg-muted px-1 rounded">x-api-key</code> header
                  with every request.
                </p>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                  <div className="text-slate-400"># Example header</div>
                  <div className="text-green-400">x-api-key: sk_live_your_api_key_here</div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Keep your API keys secure. Never expose them in client-side code or public repositories.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Endpoints */}
          <section id="endpoints">
            <h2 className="text-xl font-semibold mb-4">Endpoints</h2>
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <Card key={endpoint.path + endpoint.method}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={endpoint.method === 'GET' ? 'secondary' : 'default'}
                        className="font-mono"
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm font-mono">{endpoint.path}</code>
                    </div>
                    <CardTitle className="text-lg">{endpoint.title}</CardTitle>
                    <CardDescription>{endpoint.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {endpoint.requestBody && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Request Body</h4>
                        <div className="bg-muted rounded-lg p-3 space-y-2">
                          {Object.entries(endpoint.requestBody).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-2 text-sm">
                              <code className="text-primary">{key}</code>
                              <span className="text-muted-foreground">({value.type})</span>
                              <span className="text-muted-foreground">- {value.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {endpoint.queryParams && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Query Parameters</h4>
                        <div className="bg-muted rounded-lg p-3 space-y-2">
                          {Object.entries(endpoint.queryParams).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-2 text-sm">
                              <code className="text-primary">{key}</code>
                              <span className="text-muted-foreground">({value.type})</span>
                              <span className="text-muted-foreground">- {value.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">Response Example</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(endpoint.responseExample)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
                        {endpoint.responseExample}
                      </pre>
                    </div>

                    {endpoint.errors && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Error Codes</h4>
                        <div className="space-y-1">
                          {endpoint.errors.map((error) => (
                            <div key={error.code} className="flex items-center gap-2 text-sm">
                              <Badge variant="destructive" className="font-mono">
                                {error.code}
                              </Badge>
                              <span className="text-muted-foreground">{error.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Code Examples */}
          <section id="examples">
            <Card>
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
                <CardDescription>
                  Quick start examples in popular languages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl">
                  <TabsList>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                  </TabsList>
                  {Object.entries(codeExamples).map(([lang, code]) => (
                    <TabsContent key={lang} value={lang}>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyCode(code)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm overflow-x-auto">
                          {code}
                        </pre>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </section>

          {/* Webhooks */}
          <section id="webhooks">
            <Card>
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Receive real-time notifications when events occur.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure webhook endpoints in your dashboard to receive notifications for:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary">certificate.issued</Badge>
                    <span className="text-muted-foreground">When a new certificate is issued</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary">certificate.revoked</Badge>
                    <span className="text-muted-foreground">When a certificate is revoked</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary">verification.completed</Badge>
                    <span className="text-muted-foreground">When you verify a certificate</span>
                  </li>
                </ul>

                <div>
                  <h4 className="font-medium text-sm mb-2">Webhook Signature Verification</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    All webhooks are signed with your signing secret. Verify the signature using
                    the <code className="bg-muted px-1 rounded">x-webhook-signature</code> header.
                  </p>
                  <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`// Node.js example
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from('sha256=' + expected)
  );
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits">
            <Card>
              <CardHeader>
                <CardTitle>Rate Limits</CardTitle>
                <CardDescription>
                  API rate limits based on your plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Plan</th>
                        <th className="text-left py-2">Verifications/Month</th>
                        <th className="text-left py-2">Requests/Minute</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">Starter</td>
                        <td className="py-2">50</td>
                        <td className="py-2">10</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Professional</td>
                        <td className="py-2">500</td>
                        <td className="py-2">60</td>
                      </tr>
                      <tr>
                        <td className="py-2">Enterprise</td>
                        <td className="py-2">Unlimited</td>
                        <td className="py-2">Custom</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Rate limit headers are included in every response:
                  <code className="bg-muted px-1 rounded ml-1">X-RateLimit-Limit</code>,
                  <code className="bg-muted px-1 rounded ml-1">X-RateLimit-Remaining</code>,
                  <code className="bg-muted px-1 rounded ml-1">X-RateLimit-Reset</code>
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Error Handling */}
          <section id="errors">
            <Card>
              <CardHeader>
                <CardTitle>Error Handling</CardTitle>
                <CardDescription>
                  Standard error response format.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`{
  "error": {
    "code": "CERTIFICATE_NOT_FOUND",
    "message": "No certificate found with the provided identifier",
    "details": {
      "certificate_number": "SS-000000"
    }
  }
}`}
                </pre>
                <div>
                  <h4 className="font-medium text-sm mb-2">Common Error Codes</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <code className="text-primary">INVALID_API_KEY</code>
                      <span className="text-muted-foreground">API key is missing or invalid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-primary">CERTIFICATE_NOT_FOUND</code>
                      <span className="text-muted-foreground">Certificate doesn't exist</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-primary">RATE_LIMIT_EXCEEDED</code>
                      <span className="text-muted-foreground">Too many requests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-primary">QUOTA_EXCEEDED</code>
                      <span className="text-muted-foreground">Monthly limit reached</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
