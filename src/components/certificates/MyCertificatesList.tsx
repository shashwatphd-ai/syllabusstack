import { useNavigate } from "react-router-dom";
import { Award, Download, ExternalLink, Shield, Trophy, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCertificates, useCertificateStats, Certificate } from "@/hooks/useCertificates";
import { format } from "date-fns";

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const navigate = useNavigate();

  const getTypeConfig = () => {
    switch (certificate.certificate_type) {
      case "assessed":
        return {
          icon: Trophy,
          color: "text-amber-500",
          bg: "bg-amber-100 dark:bg-amber-900/30",
          badge: "Assessed",
          badgeVariant: "default" as const,
        };
      case "verified":
        return {
          icon: Shield,
          color: "text-blue-500",
          bg: "bg-blue-100 dark:bg-blue-900/30",
          badge: "Verified",
          badgeVariant: "secondary" as const,
        };
      default:
        return {
          icon: CheckCircle2,
          color: "text-green-500",
          bg: "bg-green-100 dark:bg-green-900/30",
          badge: "Completion",
          badgeVariant: "outline" as const,
        };
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-base">{certificate.course_title}</CardTitle>
              <CardDescription className="text-sm">
                {certificate.institution_name || certificate.instructor_name || "SyllabusStack"}
              </CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant}>{config.badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Issued</span>
            <p className="font-medium">
              {certificate.issued_at 
                ? format(new Date(certificate.issued_at), "MMM d, yyyy")
                : format(new Date(certificate.completion_date), "MMM d, yyyy")}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">ID</span>
            <p className="font-medium font-mono text-xs">{certificate.certificate_number}</p>
          </div>
          {certificate.mastery_score !== null && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Mastery Score</span>
              <p className="font-semibold text-lg">{Math.round(certificate.mastery_score)}%</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          {certificate.identity_verified && (
            <Badge variant="outline" className="text-xs gap-1">
              <Shield className="h-3 w-3" />
              ID Verified
            </Badge>
          )}
          {certificate.instructor_verified && (
            <Badge variant="outline" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Instructor Verified
            </Badge>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => navigate(`/certificate/${certificate.id}`)}
          >
            View
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Download className="h-3 w-3" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1"
            onClick={() => window.open(`/verify/${certificate.share_token}`, "_blank")}
          >
            <ExternalLink className="h-3 w-3" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsHeader() {
  const { stats, isLoading } = useCertificateStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card className="text-center p-4">
        <div className="text-2xl font-bold text-amber-500">{stats.assessed}</div>
        <div className="text-sm text-muted-foreground">Assessed</div>
      </Card>
      <Card className="text-center p-4">
        <div className="text-2xl font-bold text-blue-500">{stats.verified}</div>
        <div className="text-sm text-muted-foreground">Verified</div>
      </Card>
      <Card className="text-center p-4">
        <div className="text-2xl font-bold text-green-500">{stats.badges}</div>
        <div className="text-sm text-muted-foreground">Badges</div>
      </Card>
    </div>
  );
}

export function MyCertificatesList() {
  const { data: certificates = [], isLoading } = useCertificates();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <StatsHeader />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <Award className="h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">No certificates yet</h3>
            <p className="text-muted-foreground">
              Complete courses to earn verified credentials
            </p>
          </div>
          <Button onClick={() => navigate("/learn?tab=active")}>
            View Active Courses
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <StatsHeader />
      <div className="grid gap-4 md:grid-cols-2">
        {certificates.map(cert => (
          <CertificateCard key={cert.id} certificate={cert} />
        ))}
      </div>
    </div>
  );
}
