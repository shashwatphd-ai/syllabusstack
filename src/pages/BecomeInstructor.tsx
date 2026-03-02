import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';

/**
 * BecomeInstructor Page — Now gated to invite-only.
 * Replaces the old self-service signup form.
 */
export default function BecomeInstructorPage() {
  const navigate = useNavigate();
  const { data: roles } = useUserRoles();
  const isInstructor = roles?.some(r => r.role === 'instructor' || r.role === 'admin');

  useEffect(() => {
    if (isInstructor) {
      navigate('/teach');
    }
  }, [isInstructor, navigate]);

  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-xl mx-auto space-y-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => navigate('/teach')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teach
          </Button>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Instructor Access is Invite-Only</CardTitle>
              <CardDescription className="text-base">
                To teach on SyllabusStack, you need an invitation from an existing instructor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Ask a colleague</p>
                    <p>If you know someone who already teaches on SyllabusStack, ask them to send you an invitation from their instructor dashboard.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Have an invite link?</p>
                    <p>Click the link in your invitation email — it will take you directly to the signup page with your invite pre-filled.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/teach')}
                >
                  Go Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => navigate('/auth')}
                >
                  Log In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AppShell>
  );
}
