import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Twitter, Linkedin, Mail } from "lucide-react";
import { Logo } from "@/components/common/Logo";

export const Footer = forwardRef<HTMLElement>(function Footer(_props, ref) {
  return (
    <footer ref={ref} className="bg-indigo-900 border-t border-primary-foreground/10">
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Logo size="md" variant="light" />
            </Link>
            <p className="text-primary-foreground/50 text-sm mb-4">
              The platform that bridges what you've learned to where you're going.
            </p>
            <div className="flex gap-3">
              <a
                href="https://twitter.com/syllabusstack"
                target="_blank"
                rel="noreferrer"
                aria-label="SyllabusStack on Twitter"
                className="w-8 h-8 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/company/syllabusstack"
                target="_blank"
                rel="noreferrer"
                aria-label="SyllabusStack on LinkedIn"
                className="w-8 h-8 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="mailto:support@syllabusstack.app"
                aria-label="Email SyllabusStack support"
                className="w-8 h-8 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-colors"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Product</h4>
            <ul className="space-y-3">
              <li><a href="#features" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">How It Works</a></li>
              <li><a href="#pricing" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Pricing</a></li>
              <li><Link to="/universities" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">For Universities</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Resources</h4>
            <ul className="space-y-3">
              <li><Link to="/resources#documentation" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Documentation</Link></li>
              <li><Link to="/resources#career-guides" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Career Guides</Link></li>
              <li><Link to="/resources#blog" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Blog</Link></li>
              <li><Link to="/resources#support" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><Link to="/legal#privacy" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/legal#terms" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Terms of Service</Link></li>
              <li><Link to="/legal#cookies" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-primary-foreground/40 text-sm">
            © {new Date().getFullYear()} SyllabusStack. All rights reserved.
          </p>
          <p className="text-primary-foreground/40 text-sm">
            Built for learners and educators.
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
