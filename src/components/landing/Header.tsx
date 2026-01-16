import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/common/Logo";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-indigo-900/80 backdrop-blur-xl border-b border-primary-foreground/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" variant="light" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              Pricing
            </a>
          </nav>

          {/* CTA buttons - prevent flickering by checking isLoading */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              // Show placeholder while auth state is loading
              <div className="w-32 h-9" />
            ) : user ? (
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
              <a href="#how-it-works" className="block text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                How It Works
              </a>
              <a href="#pricing" className="block text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                Pricing
              </a>
              <div className="pt-4 border-t border-primary-foreground/10 flex flex-col gap-3">
                {isLoading ? (
                  <div className="w-full h-10" />
                ) : user ? (
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
