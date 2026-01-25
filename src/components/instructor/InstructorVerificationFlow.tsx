import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Mail, 
  Building2, 
  Key, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Linkedin,
  GraduationCap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useInstructorVerification } from "@/hooks/useInstructorVerification";

export function InstructorVerificationFlow() {
  const { user, profile } = useAuth();
  const { 
    verification, 
    isLoading, 
    isVerified, 
    trustScore,
    submitVerification, 
    useInviteCode 
  } = useInstructorVerification();
  
  const [email, setEmail] = useState(user?.email || "");
  const [institution, setInstitution] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // If already verified, show success state
  if (isVerified) {
    return (
      <Card className="border-t-4 border-green-500">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle>Verified Instructor</CardTitle>
            <CardDescription>
              Your instructor account is verified and active
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center gap-4">
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" />
              Trust Score: {trustScore}
            </Badge>
            {verification?.edu_domain_verified && (
              <Badge variant="outline" className="gap-1">
                <GraduationCap className="h-3 w-3" />
                .edu Verified
              </Badge>
            )}
          </div>
          {verification?.institution_name && (
            <p className="text-center text-muted-foreground">
              {verification.institution_name}
              {verification.department && ` • ${verification.department}`}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // If verification is pending
  if (verification?.status === 'pending') {
    return (
      <Card className="border-t-4 border-yellow-500">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full bg-yellow-100 dark:bg-yellow-900">
            <Clock className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <CardTitle>Verification Pending</CardTitle>
            <CardDescription>
              Your verification request is being reviewed
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Submitted {new Date(verification.submitted_at).toLocaleDateString()}
            </p>
            <Badge variant="secondary">
              Trust Score: {verification.trust_score}
            </Badge>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            We'll notify you by email once your verification is complete. 
            This typically takes 1-2 business days.
          </p>
        </CardContent>
      </Card>
    );
  }

  // If verification was rejected
  if (verification?.status === 'rejected') {
    return (
      <Card className="border-t-4 border-destructive">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 rounded-full bg-destructive/10">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <CardTitle>Verification Declined</CardTitle>
            <CardDescription>
              Your previous verification request was not approved
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {verification.rejection_reason && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-1">Reason:</p>
              <p className="text-sm text-muted-foreground">
                {verification.rejection_reason}
              </p>
            </div>
          )}
          <p className="text-sm text-center text-muted-foreground">
            You can submit a new verification request with additional documentation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleEmailSubmit = () => {
    submitVerification.mutate({
      email,
      institution_name: institution || undefined,
      department: department || undefined,
      title: title || undefined,
      linkedin_url: linkedinUrl || undefined,
    });
  };

  const handleInviteCodeSubmit = () => {
    useInviteCode.mutate(inviteCode);
  };

  const isEduEmail = email?.includes('.edu');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Verify Your Instructor Account
        </CardTitle>
        <CardDescription>
          Verified instructors build trust with students and can issue certificates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email Verification
            </TabsTrigger>
            <TabsTrigger value="invite" className="gap-2">
              <Key className="h-4 w-4" />
              Invite Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">How it works:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>.edu email addresses</strong> are automatically verified</li>
                <li>• Other emails require manual review (1-2 business days)</li>
                <li>• Add your institution for faster approval</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Institutional Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name@university.edu"
                  />
                  {isEduEmail && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                {isEduEmail && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ .edu domain detected - eligible for automatic verification
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="institution">
                  Institution Name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="institution"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="University of Example"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Professor"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">
                  LinkedIn Profile <span className="text-muted-foreground">(optional, speeds up review)</span>
                </Label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="linkedin"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button 
                onClick={handleEmailSubmit}
                disabled={!email || submitVerification.isPending}
                className="w-full"
              >
                {submitVerification.isPending ? "Submitting..." : "Submit Verification Request"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="invite" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">Have an invite code?</p>
              <p className="text-muted-foreground">
                Partner institutions and beta participants receive special codes 
                for instant verification.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Invite Code</Label>
                <Input
                  id="code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ENTER-CODE"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={20}
                />
              </div>

              <Button 
                onClick={handleInviteCodeSubmit}
                disabled={!inviteCode || useInviteCode.isPending}
                className="w-full"
              >
                {useInviteCode.isPending ? "Verifying..." : "Use Invite Code"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
