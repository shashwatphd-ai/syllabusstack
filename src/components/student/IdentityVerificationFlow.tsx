import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  UserCheck, 
  Shield, 
  Camera, 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";

export function IdentityVerificationFlow() {
  const { 
    idvStatus, 
    isLoading, 
    isVerified,
    initiateVerification,
    simulateCompletion 
  } = useIdentityVerification();
  
  const [step, setStep] = useState<'intro' | 'verifying' | 'complete'>('intro');

  // Already verified
  if (isVerified) {
    return (
      <Card className="border-t-4 border-green-500">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle>Identity Verified</CardTitle>
            <CardDescription>
              Your identity has been verified
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center gap-4">
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" />
              Verified
            </Badge>
            {idvStatus?.document_type && (
              <Badge variant="outline" className="gap-1">
                <FileCheck className="h-3 w-3" />
                {idvStatus.document_type.replace('_', ' ')}
              </Badge>
            )}
          </div>
          {idvStatus?.verified_name && (
            <p className="text-center text-muted-foreground">
              Verified as: {idvStatus.verified_name}
            </p>
          )}
          {idvStatus?.completed_at && (
            <p className="text-center text-sm text-muted-foreground">
              Verified on {new Date(idvStatus.completed_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Verification in progress
  if (idvStatus?.status === 'pending' || idvStatus?.status === 'processing') {
    return (
      <Card className="border-t-4 border-yellow-500">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full bg-yellow-100 dark:bg-yellow-900">
            <Loader2 className="h-10 w-10 text-yellow-600 dark:text-yellow-400 animate-spin" />
          </div>
          <div>
            <CardTitle>Verification In Progress</CardTitle>
            <CardDescription>
              {idvStatus.status === 'pending' 
                ? 'Waiting for you to complete verification' 
                : 'Processing your verification...'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={idvStatus.status === 'processing' ? 75 : 25} />
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Session created</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {idvStatus.status === 'processing' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span>Document upload</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Verification complete</span>
            </div>
          </div>

          {/* Demo mode: simulate completion */}
          {idvStatus.verification_id && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Demo mode - simulate verification?</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => simulateCompletion.mutate(idvStatus.verification_id!)}
                  disabled={simulateCompletion.isPending}
                >
                  {simulateCompletion.isPending ? 'Verifying...' : 'Simulate Complete'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {idvStatus.expires_at && (
            <p className="text-xs text-center text-muted-foreground">
              Session expires: {new Date(idvStatus.expires_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Failed verification
  if (idvStatus?.status === 'failed') {
    return (
      <Card className="border-t-4 border-destructive">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full bg-destructive/10">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              We couldn't verify your identity
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {idvStatus.failure_reason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{idvStatus.failure_reason}</AlertDescription>
            </Alert>
          )}
          <Button 
            onClick={() => initiateVerification.mutate()}
            disabled={initiateVerification.isPending}
            className="w-full"
          >
            {initiateVerification.isPending ? 'Starting...' : 'Try Again'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initial state - show intro
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Verify Your Identity
        </CardTitle>
        <CardDescription>
          Identity verification is required for assessed certificates with mastery scores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium">What you'll need:</p>
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <FileCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Government-issued ID</p>
                <p className="text-xs text-muted-foreground">
                  Passport, driver's license, or national ID card
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Camera className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Camera access</p>
                <p className="text-xs text-muted-foreground">
                  For document scanning and selfie verification
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">2-3 minutes</p>
                <p className="text-xs text-muted-foreground">
                  The verification process is quick and secure
                </p>
              </div>
            </div>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Your data is encrypted and processed securely. We use industry-leading 
            identity verification to protect your credentials.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={() => initiateVerification.mutate()}
          disabled={initiateVerification.isPending || isLoading}
          className="w-full"
          size="lg"
        >
          {initiateVerification.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting Verification...
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4 mr-2" />
              Start Identity Verification
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By continuing, you agree to our identity verification terms and privacy policy.
        </p>
      </CardContent>
    </Card>
  );
}
