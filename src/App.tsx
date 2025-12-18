import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/dream-jobs" element={<DreamJobsPage />} />
          <Route path="/dream-jobs/:jobId" element={<DreamJobDetailPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/scanner" element={<SyllabusScannerPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
