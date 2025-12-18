import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard, GuestGuard } from "@/components/auth/AuthGuard";
import { queryClient } from "@/lib/query-client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import OnboardingPage from "./pages/Onboarding";
import DashboardPage from "./pages/Dashboard";
import CoursesPage from "./pages/Courses";
import DreamJobsPage from "./pages/DreamJobs";
import DreamJobDetailPage from "./pages/DreamJobDetail";
import AnalysisPage from "./pages/Analysis";
import RecommendationsPage from "./pages/Recommendations";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import SyllabusScannerPage from "./pages/SyllabusScanner";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/scanner" element={<SyllabusScannerPage />} />
            
            {/* Auth routes (redirect if logged in) */}
            <Route path="/auth" element={<GuestGuard><Auth /></GuestGuard>} />
            
            {/* Protected routes */}
            <Route path="/onboarding" element={<AuthGuard><OnboardingPage /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
            <Route path="/courses" element={<AuthGuard><CoursesPage /></AuthGuard>} />
            <Route path="/dream-jobs" element={<AuthGuard><DreamJobsPage /></AuthGuard>} />
            <Route path="/dream-jobs/:jobId" element={<AuthGuard><DreamJobDetailPage /></AuthGuard>} />
            <Route path="/analysis" element={<AuthGuard><AnalysisPage /></AuthGuard>} />
            <Route path="/recommendations" element={<AuthGuard><RecommendationsPage /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
