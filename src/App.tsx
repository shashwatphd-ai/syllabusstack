import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard, GuestGuard } from "@/components/auth/AuthGuard";
import { queryClient } from "@/lib/query-client";
import { AchievementToastProvider } from "@/components/achievements/AchievementUnlockToast";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import OnboardingPage from "./pages/Onboarding";
import DashboardPage from "./pages/Dashboard";
import CoursesPage from "./pages/Courses";
import CourseDetailPage from "./pages/CourseDetail";
import DreamJobsPage from "./pages/DreamJobs";
import DreamJobDetailPage from "./pages/DreamJobDetail";
import AnalysisPage from "./pages/Analysis";
import RecommendationsPage from "./pages/Recommendations";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import BillingPage from "./pages/Billing";
import SyllabusScannerPage from "./pages/SyllabusScanner";
import UsagePage from "./pages/Usage";
import TestResultsPage from "./pages/TestResults";
import ResourcesPage from "./pages/Resources";
import LegalPage from "./pages/Legal";
import UniversitiesPage from "./pages/Universities";
import HowItWorksPage from "./pages/HowItWorks";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import InstructorCoursesPage from "./pages/instructor/InstructorCourses";
import InstructorCourseDetailPage from "./pages/instructor/InstructorCourseDetail";
import QuickCourseSetupPage from "./pages/instructor/QuickCourseSetup";
import { StudentCoursesPage, StudentCourseDetailPage, LearningObjectivePage, AssessmentPage } from "./pages/student";
// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import OutcomesReport from "./pages/admin/OutcomesReport";
import CourseManagement from "./pages/admin/CourseManagement";
import BrandingSettings from "./pages/admin/BrandingSettings";

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
            <Route path="/scanner" element={<SyllabusScannerPage />} />
            <Route path="/test-results" element={<TestResultsPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/universities" element={<UniversitiesPage />} />

            {/* Auth routes (redirect if logged in) */}
            <Route path="/auth" element={<GuestGuard><Auth /></GuestGuard>} />
            <Route path="/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes */}
            <Route path="/onboarding" element={<AuthGuard><OnboardingPage /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
            <Route path="/courses" element={<AuthGuard><CoursesPage /></AuthGuard>} />
            <Route path="/courses/:id" element={<AuthGuard><CourseDetailPage /></AuthGuard>} />
            <Route path="/dream-jobs" element={<AuthGuard><DreamJobsPage /></AuthGuard>} />
            <Route path="/dream-jobs/:jobId" element={<AuthGuard><DreamJobDetailPage /></AuthGuard>} />
            <Route path="/analysis" element={<AuthGuard><AnalysisPage /></AuthGuard>} />
            <Route path="/recommendations" element={<AuthGuard><RecommendationsPage /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
            <Route path="/billing" element={<AuthGuard><BillingPage /></AuthGuard>} />
            <Route path="/usage" element={<AuthGuard><UsagePage /></AuthGuard>} />

            {/* Student learning routes */}
            <Route path="/learn/courses" element={<AuthGuard><StudentCoursesPage /></AuthGuard>} />
            <Route path="/learn/courses/:id" element={<AuthGuard><StudentCourseDetailPage /></AuthGuard>} />
            <Route path="/learn/objective/:loId/assess" element={<AuthGuard><AssessmentPage /></AuthGuard>} />
            <Route path="/learn/objective/:loId" element={<AuthGuard><LearningObjectivePage /></AuthGuard>} />

            {/* Instructor routes */}
            <Route path="/instructor/courses" element={<AuthGuard><InstructorCoursesPage /></AuthGuard>} />
            <Route path="/instructor/courses/:id" element={<AuthGuard><InstructorCourseDetailPage /></AuthGuard>} />
            <Route path="/instructor/quick-setup" element={<AuthGuard><QuickCourseSetupPage /></AuthGuard>} />

            {/* Admin routes (University tier) */}
            <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
            <Route path="/admin/users" element={<AuthGuard><UserManagement /></AuthGuard>} />
            <Route path="/admin/outcomes" element={<AuthGuard><OutcomesReport /></AuthGuard>} />
            <Route path="/admin/courses" element={<AuthGuard><CourseManagement /></AuthGuard>} />
            <Route path="/admin/branding" element={<AuthGuard><BrandingSettings /></AuthGuard>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
