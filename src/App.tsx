import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard, GuestGuard } from "@/components/auth/AuthGuard";
import { AdminGuard } from "@/components/auth/AdminGuard";
import { queryClient } from "@/lib/query-client";
import { AchievementToastProvider } from "@/components/achievements/AchievementUnlockToast";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import OnboardingPage from "./pages/Onboarding";
import DashboardPage from "./pages/Dashboard";
import CourseDetailPage from "./pages/CourseDetail";
import DreamJobDetailPage from "./pages/DreamJobDetail";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import BillingPage from "./pages/Billing";
import CheckoutPage from "./pages/Checkout";
import SyllabusScannerPage from "./pages/SyllabusScanner";
import UsagePage from "./pages/Usage";
import TestResultsPage from "./pages/TestResults";
import ResourcesPage from "./pages/Resources";
import LegalPage from "./pages/Legal";
import UniversitiesPage from "./pages/Universities";
import HowItWorksPage from "./pages/HowItWorks";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import PaymentSuccessPage from "./pages/PaymentSuccess";
import PaymentCancelPage from "./pages/PaymentCancel";
import LearningPathPage from "./pages/LearningPath";
import InstructorCoursesPage from "./pages/instructor/InstructorCourses";
import InstructorCourseDetailPage from "./pages/instructor/InstructorCourseDetail";
import QuickCourseSetupPage from "./pages/instructor/QuickCourseSetup";
import InstructorVerificationPage from "./pages/instructor/InstructorVerification";
import CourseAnalyticsPage from "./pages/instructor/CourseAnalytics";
import GradebookPage from "./pages/instructor/Gradebook";
import { StudentCourseDetailPage, LearningObjectivePage, AssessmentPage, StudentSlidePage, IdentityVerificationPage } from "./pages/student";
// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import OutcomesReport from "./pages/admin/OutcomesReport";
import CourseManagement from "./pages/admin/CourseManagement";
import BrandingSettings from "./pages/admin/BrandingSettings";
import OrganizationDashboard from "./pages/admin/OrganizationDashboard";
import InstructorReviewQueue from "./pages/admin/InstructorReviewQueue";
import ContentModerationPage from "./pages/admin/ContentModeration";
import RoleManagementPage from "./pages/admin/RoleManagement";
import SystemHealthPage from "./pages/admin/SystemHealth";
// Unified pages (new architecture)
import LearnPage from "./pages/Learn";
import CareerPathPage from "./pages/CareerPath";
import TeachPage from "./pages/Teach";
import BecomeInstructorPage from "./pages/BecomeInstructor";
import ProgressPage from "./pages/Progress";
// Certificate pages
import CertificateViewPage from "./pages/certificate/CertificateView";
import PublicCertificateVerifyPage from "./pages/verify/PublicCertificateVerify";
import EmployerDashboard from "./pages/employer/EmployerDashboard";
import EmployerSignupPage from "./pages/employer/EmployerSignup";
import EmployerApiDocsPage from "./pages/employer/ApiDocs";
import WebhookSettingsPage from "./pages/employer/WebhookSettings";
import EmployersPage from "./pages/Employers";
import HelpCenterPage from "./pages/HelpCenter";
import HelpArticlePage from "./pages/HelpArticle";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AchievementToastProvider />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/employers" element={<EmployersPage />} />
            <Route path="/scanner" element={<SyllabusScannerPage />} />
            <Route path="/test-results" element={<TestResultsPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/help/article/:articleId" element={<HelpArticlePage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/universities" element={<UniversitiesPage />} />
            {/* Payment redirect pages */}
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/payment-cancel" element={<PaymentCancelPage />} />
            {/* Public certificate verification */}
            <Route path="/verify/:shareToken" element={<PublicCertificateVerifyPage />} />

            {/* Auth routes (redirect if logged in) */}
            <Route path="/auth" element={<GuestGuard><Auth /></GuestGuard>} />
            <Route path="/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes */}
            <Route path="/onboarding" element={<AuthGuard><OnboardingPage /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />

            {/* NEW UNIFIED PAGES */}
            <Route path="/learn" element={<AuthGuard><LearnPage /></AuthGuard>} />
            <Route path="/career" element={<AuthGuard><CareerPathPage /></AuthGuard>} />
            <Route path="/teach" element={<AuthGuard><TeachPage /></AuthGuard>} />
            <Route path="/become-instructor" element={<AuthGuard><BecomeInstructorPage /></AuthGuard>} />
            <Route path="/progress" element={<AuthGuard><ProgressPage /></AuthGuard>} />
            <Route path="/learning-path" element={<AuthGuard><LearningPathPage /></AuthGuard>} />

            {/* LEGACY REDIRECTS - redirect old URLs to new unified pages */}
            <Route path="/courses" element={<Navigate to="/learn?tab=transcript" replace />} />
            <Route path="/dream-jobs" element={<Navigate to="/career?tab=jobs" replace />} />
            <Route path="/analysis" element={<Navigate to="/career?tab=gaps" replace />} />
            <Route path="/recommendations" element={<Navigate to="/career?tab=actions" replace />} />
            <Route path="/learn/courses" element={<Navigate to="/learn?tab=active" replace />} />

            {/* Legacy detail pages still work */}
            <Route path="/courses/:id" element={<AuthGuard><CourseDetailPage /></AuthGuard>} />
            <Route path="/dream-jobs/:jobId" element={<AuthGuard><DreamJobDetailPage /></AuthGuard>} />

            {/* Account pages */}
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
            <Route path="/billing" element={<AuthGuard><BillingPage /></AuthGuard>} />
            <Route path="/checkout" element={<AuthGuard><CheckoutPage /></AuthGuard>} />
            <Route path="/usage" element={<AuthGuard><UsagePage /></AuthGuard>} />
            {/* Certificate viewing */}
            <Route path="/certificate/:id" element={<AuthGuard><CertificateViewPage /></AuthGuard>} />

            {/* Student learning routes - course detail, objectives, and slides */}
            <Route path="/learn/course/:id" element={<AuthGuard><StudentCourseDetailPage /></AuthGuard>} />
            <Route path="/learn/courses/:id" element={<AuthGuard><StudentCourseDetailPage /></AuthGuard>} />
            <Route path="/learn/objective/:loId/assess" element={<AuthGuard><AssessmentPage /></AuthGuard>} />
            <Route path="/learn/objective/:loId" element={<AuthGuard><LearningObjectivePage /></AuthGuard>} />
            <Route path="/learn/slides/:slideId" element={<AuthGuard><StudentSlidePage /></AuthGuard>} />
            <Route path="/verify-identity" element={<AuthGuard><IdentityVerificationPage /></AuthGuard>} />

            {/* Instructor routes */}
            <Route path="/instructor/courses" element={<AuthGuard><InstructorCoursesPage /></AuthGuard>} />
            <Route path="/instructor/courses/:id" element={<AuthGuard><InstructorCourseDetailPage /></AuthGuard>} />
            <Route path="/instructor/courses/:courseId/analytics" element={<AuthGuard><CourseAnalyticsPage /></AuthGuard>} />
            <Route path="/instructor/courses/:courseId/gradebook" element={<AuthGuard><GradebookPage /></AuthGuard>} />
            <Route path="/instructor/quick-setup" element={<AuthGuard><QuickCourseSetupPage /></AuthGuard>} />
            <Route path="/instructor/verification" element={<AuthGuard><InstructorVerificationPage /></AuthGuard>} />

            {/* Admin routes (requires admin role) */}
            <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/admin/users" element={<AdminGuard><UserManagement /></AdminGuard>} />
            <Route path="/admin/outcomes" element={<AdminGuard><OutcomesReport /></AdminGuard>} />
            <Route path="/admin/courses" element={<AdminGuard><CourseManagement /></AdminGuard>} />
            <Route path="/admin/branding" element={<AdminGuard><BrandingSettings /></AdminGuard>} />
            <Route path="/admin/instructor-review" element={<AdminGuard><InstructorReviewQueue /></AdminGuard>} />
            <Route path="/admin/content-moderation" element={<AdminGuard><ContentModerationPage /></AdminGuard>} />
            <Route path="/admin/roles" element={<AdminGuard><RoleManagementPage /></AdminGuard>} />
            <Route path="/admin/system-health" element={<AdminGuard><SystemHealthPage /></AdminGuard>} />
            <Route path="/organization" element={<AuthGuard><OrganizationDashboard /></AuthGuard>} />
            <Route path="/employer" element={<AuthGuard><EmployerDashboard /></AuthGuard>} />
            <Route path="/employer/signup" element={<AuthGuard><EmployerSignupPage /></AuthGuard>} />
            <Route path="/employer/api-docs" element={<EmployerApiDocsPage />} />
            <Route path="/employer/webhooks" element={<AuthGuard><WebhookSettingsPage /></AuthGuard>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
