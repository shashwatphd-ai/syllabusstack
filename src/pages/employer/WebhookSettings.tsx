import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Webhook,
  Plus,
  Settings,
  Shield,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Code,
  Copy,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmployerAccount, useEmployerWebhooks, WEBHOOK_EVENTS } from '@/hooks/useEmployerAccount';
import { WebhookConfig } from '@/components/employer/WebhookConfig';
import { useToast } from '@/hooks/use-toast';

export default function WebhookSettings() {
  const { data: account, isLoading: accountLoading } = useEmployerAccount();
  const { data: webhooks = [] } = useEmployerWebhooks(account?.id);
  const { toast } = useToast();

  if (accountLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Employer Account</h2>
            <p className="text-muted-foreground mb-4">
              You need an employer account to configure webhooks.
            </p>
            <Button asChild>
              <Link to="/employer">Set Up Employer Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeWebhooks = webhooks.filter(w => w.is_active);
  // Note: delivery_count doesn't exist in the schema - use 0 for now
  const totalDeliveries = 0;
  const failedWebhooks = webhooks.filter(w => (w.failure_count || 0) > 0);

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Button asChild variant="ghost" size="sm" className="h-auto p-0">
            <Link to="/employer" className="flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Webhook className="h-7 w-7 text-primary" />
          Webhook Settings
        </h1>
        <p className="text-muted-foreground">
          Configure webhooks to receive real-time notifications about certificate events.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Webhook className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeWebhooks.length}</div>
                <div className="text-xs text-muted-foreground">Active Endpoints</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalDeliveries}</div>
                <div className="text-xs text-muted-foreground">Total Deliveries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{failedWebhooks.length}</div>
                <div className="text-xs text-muted-foreground">With Failures</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints" className="gap-2">
            <Settings className="h-4 w-4" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Webhook className="h-4 w-4" />
            Event Types
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="testing" className="gap-2">
            <Code className="h-4 w-4" />
            Testing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4">
          <WebhookConfig accountId={account.id} />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Event Types</CardTitle>
              <CardDescription>
                Subscribe to these events to receive notifications when they occur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event.value} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                    <Badge variant="outline" className="font-mono text-xs">
                      {event.value}
                    </Badge>
                    <div>
                      <p className="font-medium">{event.label}</p>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Security</CardTitle>
              <CardDescription>
                How to verify webhook signatures and secure your endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Signature Verification</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  All webhooks include a signature header that you should verify to ensure the request
                  came from SyllabusStack.
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
                  <p className="text-muted-foreground"># Headers included with each webhook</p>
                  <p>X-Webhook-Timestamp: 1706400000</p>
                  <p>X-Webhook-Signature: v1=abc123...</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Verification Code (Node.js)</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <pre>{`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret, timestamp) {
  const signedPayload = \`\${timestamp}.\${JSON.stringify(payload)}\`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const providedSignature = signature.replace('v1=', '');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
}`}</pre>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Best Practices</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Always verify the webhook signature before processing</li>
                  <li>Check that the timestamp is within 5 minutes to prevent replay attacks</li>
                  <li>Use HTTPS endpoints only</li>
                  <li>Respond with 2xx status within 30 seconds</li>
                  <li>Implement idempotency using the event ID</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Your Webhooks</CardTitle>
              <CardDescription>
                Send a test event to verify your endpoint is configured correctly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Sample Payload</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <pre>{`{
  "event": "certificate.issued",
  "timestamp": "2026-01-27T10:00:00Z",
  "data": {
    "certificate_id": "cert_123",
    "certificate_number": "SS-ABC123",
    "holder_name": "John Doe",
    "course_title": "Web Development 101",
    "mastery_score": 87.5,
    "identity_verified": true,
    "issued_at": "2026-01-27T10:00:00Z"
  }
}`}</pre>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">cURL Example</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`curl -X POST https://your-endpoint.com/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Timestamp: $(date +%s)" \\
  -H "X-Webhook-Signature: v1=test" \\
  -d '{"event":"test","data":{}}'`);
                      toast({ title: 'Copied to clipboard' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <pre>{`curl -X POST https://your-endpoint.com/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Timestamp: $(date +%s)" \\
  -H "X-Webhook-Signature: v1=test" \\
  -d '{"event":"test","data":{}}'`}</pre>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Note: Test events are automatically sent when you create a new webhook endpoint.
                  Check your endpoint logs to verify receipt.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
