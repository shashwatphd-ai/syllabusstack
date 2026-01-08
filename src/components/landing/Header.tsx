import { Button } from "@/components/ui/button";
import { GraduationCap, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-indigo-900/80 backdrop-blur-xl border-b border-primary-foreground/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-coral-400 to-coral-500 flex items-center justify-center shadow-lg shadow-coral-500/25">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary-foreground">
              Syllabus<span className="text-coral-400">Stack</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              Features
            </a>
            <Link to="/how-it-works" className="text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              How It Works
            </Link>
            <Link to="/scanner" className="text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              Syllabus Scanner
            </Link>
          </nav>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Button asChild variant="hero" size="sm">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/5">
                  <Link to="/auth">Log In</Link>
                </Button>
                <Button asChild variant="hero" size="sm">
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-primary-foreground/70 hover:text-primary-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-indigo-900/95 backdrop-blur-xl border-t border-primary-foreground/10">
            <div className="container mx-auto px-6 py-4 space-y-4">
              <a href="#features" className="block text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                Features
              </a>
              <Link to="/how-it-works" className="block text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                How It Works
              </Link>
              <Link to="/scanner" className="block text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                Syllabus Scanner
              </Link>
              <div className="pt-4 border-t border-primary-foreground/10 flex flex-col gap-3">
                {user ? (
                  <Button asChild variant="hero" className="w-full">
                    <Link to="/dashboard">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="ghost" className="w-full text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/5">
                      <Link to="/auth">Log In</Link>
                    </Button>
                    <Button asChild variant="hero" className="w-full">
                      <Link to="/auth">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
