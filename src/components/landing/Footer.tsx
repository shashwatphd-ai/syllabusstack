import { Link } from "react-router-dom";
import { GraduationCap, Twitter, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-navy-900 border-t border-primary-foreground/10">
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-primary-foreground">
                Edu<span className="text-teal-400">Three</span>
              </span>
            </Link>
            <p className="text-primary-foreground/50 text-sm mb-4">
              AI-powered career intelligence for students who want honest answers, not empty encouragement.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-8 h-8 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground transition-colors">
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
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">For Universities</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Resources</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Documentation</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Career Guides</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-primary-foreground/40 text-sm">
            © {new Date().getFullYear()} EduThree. All rights reserved.
          </p>
          <p className="text-primary-foreground/40 text-sm">
            Made with AI that tells the truth.
          </p>
        </div>
      </div>
    </footer>
  );
}
