import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Award, 
  Shield, 
  GraduationCap, 
  Download, 
  Share2, 
  ExternalLink,
  CheckCircle2,
  Calendar,
  User,
  BookOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CertificateData {
  id: string;
  certificate_number: string;
  certificate_type: "completion_badge" | "verified" | "assessed";
  course_title: string;
  instructor_name: string | null;
  institution_name: string | null;
  completion_date: string;
  mastery_score: number | null;
  skill_breakdown: Record<string, number> | null;
  identity_verified: boolean;
  instructor_verified: boolean;
  share_token: string;
  issued_at: string;
  status: string;
  pdf_path: string | null;
  user_id: string;
}

const tierConfig = {
  completion_badge: {
    label: "Completion Badge",
    icon: GraduationCap,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    borderColor: "border-blue-500",
  },
  verified: {
    label: "Verified Certificate",
    icon: Shield,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    borderColor: "border-green-500",
  },
  assessed: {
    label: "Assessed Certificate",
    icon: Award,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    borderColor: "border-purple-500",
  },
};

export default function CertificateView() {
  const { id } = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [holderName, setHolderName] = useState<string>("");

  useEffect(() => {
    async function fetchCertificate() {
      if (!id) return;

      try {
        const { data: cert, error } = await supabase
          .from("certificates")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        
        // Transform and type the certificate data
        const typedCert: CertificateData = {
          id: cert.id,
          certificate_number: cert.certificate_number,
          certificate_type: cert.certificate_type as "completion_badge" | "verified" | "assessed",
          course_title: cert.course_title,
          instructor_name: cert.instructor_name,
          institution_name: cert.institution_name,
          completion_date: cert.completion_date,
          mastery_score: cert.mastery_score,
          skill_breakdown: cert.skill_breakdown as Record<string, number> | null,
          identity_verified: cert.identity_verified,
          instructor_verified: cert.instructor_verified,
          share_token: cert.share_token,
          issued_at: cert.issued_at,
          status: cert.status,
          pdf_path: cert.pdf_path,
          user_id: cert.user_id,
        };
        setCertificate(typedCert);

        // Fetch holder name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", cert.user_id)
          .single();

        setHolderName(profile?.full_name || "Certificate Holder");
      } catch (error) {
        console.error("Error fetching certificate:", error);
        toast({
          title: "Error",
          description: "Failed to load certificate",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchCertificate();
  }, [id]);

  const handleShare = async () => {
    if (!certificate) return;

    const shareUrl = `${window.location.origin}/verify/${certificate.share_token}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${certificate.course_title} Certificate`,
          text: `I earned a ${tierConfig[certificate.certificate_type].label} for ${certificate.course_title}!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed, fall back to clipboard
        await copyToClipboard(shareUrl);
      }
    } else {
      await copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Link copied!",
        description: "Verification link copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container max-w-3xl py-8">
        <Card>
          <CardHeader className="space-y-4">
            <Skeleton className="h-12 w-48 mx-auto" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="container max-w-3xl py-8">
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">Certificate Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This certificate may have been removed or doesn't exist.
            </p>
            <Button asChild>
              <Link to="/student/courses">Back to Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = tierConfig[certificate.certificate_type];
  const TierIcon = config.icon;

  return (
    <div className="container max-w-3xl py-8">
      <Card className={`border-t-4 ${config.borderColor}`}>
        <CardHeader className="text-center space-y-4">
          <div className={`mx-auto p-4 rounded-full ${config.color}`}>
            <TierIcon className="h-10 w-10" />
          </div>
          
          <div>
            <Badge className={config.color}>{config.label}</Badge>
            <h1 className="text-2xl font-bold mt-2">{certificate.course_title}</h1>
            <p className="text-lg text-muted-foreground">Certificate of {certificate.certificate_type === "assessed" ? "Mastery" : "Completion"}</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Certificate details */}
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">This certifies that</p>
            <p className="text-2xl font-semibold">{holderName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              has successfully completed the requirements for
            </p>
            <p className="text-lg font-medium mt-1">{certificate.course_title}</p>
          </div>

          {/* Mastery score for assessed certificates */}
          {certificate.certificate_type === "assessed" && certificate.mastery_score !== null && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Mastery Score</p>
              <div className="text-4xl font-bold text-primary">
                {Math.round(certificate.mastery_score)}%
              </div>
              {certificate.skill_breakdown && Object.keys(certificate.skill_breakdown).length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(certificate.skill_breakdown).map(([skill, score]) => (
                    <div key={skill} className="flex justify-between bg-muted/50 rounded px-3 py-1">
                      <span className="truncate">{skill}</span>
                      <span className="font-medium">{Math.round(score as number)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Meta information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Completion Date</p>
                <p className="font-medium">
                  {format(new Date(certificate.completion_date), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
            
            {certificate.instructor_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Instructor</p>
                  <p className="font-medium">{certificate.instructor_name}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Certificate ID</p>
                <p className="font-mono font-medium">{certificate.certificate_number}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Issued</p>
                <p className="font-medium">
                  {format(new Date(certificate.issued_at), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-2 justify-center">
            {certificate.identity_verified && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Identity Verified
              </Badge>
            )}
            {certificate.instructor_verified && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Verified Instructor
              </Badge>
            )}
            {certificate.certificate_type === "assessed" && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Proctored Assessment
              </Badge>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={handleShare} variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            
            {certificate.pdf_path && (
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}

            <Button asChild>
              <Link to={`/verify/${certificate.share_token}`} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Verification Page
              </Link>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Employers and institutions can verify this certificate at{" "}
            <span className="font-mono">syllabusstack.lovable.app/verify/{certificate.share_token.slice(0, 8)}...</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
