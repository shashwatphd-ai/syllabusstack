import { Button } from "@/components/ui/button";
import { GraduationCap, Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-navy-900/80 backdrop-blur-xl border-b border-primary-foreground/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary-foreground">
              Edu<span className="text-teal-400">Three</span>
            </span>
          </a>

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

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/5">
              Log In
            </Button>
            <Button variant="hero" size="sm">
              Get Started
            </Button>
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
          <div className="md:hidden bg-navy-900/95 backdrop-blur-xl border-t border-primary-foreground/10">
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
                <Button variant="ghost" className="w-full text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/5">
                  Log In
                </Button>
                <Button variant="hero" className="w-full">
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
