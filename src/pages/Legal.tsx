import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LegalPage() {
  useSEO({
    title: "Legal",
    description: "SyllabusStack legal information: privacy policy, terms of service, and cookie policy.",
    canonical: "/legal",
  });

  const lastUpdated = "January 8, 2025";

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Legal</h1>
          <p className="mt-2 text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
          <div className="mt-6 flex gap-3 flex-wrap">
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
            <Button asChild variant="ghost">
              <a href="#privacy">Privacy Policy</a>
            </Button>
            <Button asChild variant="ghost">
              <a href="#terms">Terms of Service</a>
            </Button>
            <Button asChild variant="ghost">
              <a href="#cookies">Cookie Policy</a>
            </Button>
          </div>
        </header>

        {/* Privacy Policy */}
        <section id="privacy" className="scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. Information We Collect</h3>
                <p className="mb-3">SyllabusStack collects the following categories of information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Email address, full name, and password (encrypted) when you create an account.</li>
                  <li><strong>Academic Profile:</strong> University name, major, student level, and expected graduation year that you voluntarily provide.</li>
                  <li><strong>Educational Content:</strong> Syllabus documents (PDF, DOCX, or text) and course information you upload for analysis.</li>
                  <li><strong>Career Preferences:</strong> Dream job titles, target company types, and location preferences you specify.</li>
                  <li><strong>Usage Data:</strong> Interaction with educational content including video watch time, engagement patterns, and assessment responses.</li>
                  <li><strong>Technical Data:</strong> Browser type, device information, IP address, and session activity timestamps.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">2. How We Use Your Information</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Service Delivery:</strong> To analyze your coursework against job requirements and generate personalized career guidance.</li>
                  <li><strong>AI Processing:</strong> Your syllabus content and career preferences are processed by artificial intelligence systems to extract capabilities and identify skill gaps.</li>
                  <li><strong>Content Recommendations:</strong> To search for and recommend educational videos, courses, and resources relevant to your skill gaps.</li>
                  <li><strong>Communications:</strong> To send you optional weekly progress digests and important service updates (you can opt out at any time).</li>
                  <li><strong>Service Improvement:</strong> To improve our AI models, user experience, and platform features using aggregated, anonymized data.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">3. Third-Party Services</h3>
                <p className="mb-3">We integrate with third-party services to provide our functionality. These services have their own privacy policies governing their handling of data:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>AI Processing Services:</strong> Your content is processed by third-party artificial intelligence providers to generate analysis and recommendations.</li>
                  <li><strong>Video Platforms:</strong> We embed educational content from third-party video platforms. Your interaction with these embeds may be subject to their respective privacy policies.</li>
                  <li><strong>Course Discovery Services:</strong> We use third-party search services to find relevant online courses and learning resources based on your skill gaps.</li>
                  <li><strong>Payment Processing:</strong> If you subscribe to paid features, a third-party payment processor handles transactions. We store only subscription status, not payment details.</li>
                  <li><strong>Email Services:</strong> Transactional emails are sent through a third-party email service provider.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">4. Data Security & Storage</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Your data is stored securely using industry-standard encryption and access controls.</li>
                  <li>Your coursework and analyses are private by default and accessible only to your authenticated account.</li>
                  <li>We implement Row Level Security (RLS) policies to ensure users can only access their own data.</li>
                  <li>Passwords are hashed and never stored in plain text.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">5. Data Retention</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We retain your account data for as long as your account is active.</li>
                  <li>You may request deletion of your account and associated data at any time by contacting us.</li>
                  <li>Anonymized, aggregated analytics data may be retained indefinitely for service improvement.</li>
                  <li>AI-generated analyses may be cached temporarily to improve performance.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">6. Your Rights</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access:</strong> You can view all your stored data through your account dashboard.</li>
                  <li><strong>Export:</strong> You can export your courses, analyses, and recommendations at any time.</li>
                  <li><strong>Deletion:</strong> You may request complete deletion of your account and data.</li>
                  <li><strong>Correction:</strong> You can update your profile information at any time.</li>
                  <li><strong>Opt-Out:</strong> You can disable email notifications in your settings.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">7. Children's Privacy</h3>
                <p>SyllabusStack is intended for users 16 years of age and older. We do not knowingly collect personal information from children under 16. If we learn we have collected such information, we will delete it promptly.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">8. Contact</h3>
                <p>For privacy-related inquiries, contact us at <a href="mailto:privacy@syllabusstack.com" className="underline text-primary">privacy@syllabusstack.com</a>.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Terms of Service */}
        <section id="terms" className="mt-8 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Terms of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. Acceptance of Terms</h3>
                <p>By accessing or using SyllabusStack ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">2. Description of Service</h3>
                <p className="mb-3">SyllabusStack is an AI-powered career intelligence platform that:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Analyzes educational coursework to extract marketable capabilities</li>
                  <li>Compares your skills against real job market requirements</li>
                  <li>Provides personalized gap analysis and learning recommendations</li>
                  <li>Curates educational content from third-party sources</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">3. Disclaimer of Guarantees</h3>
                <p className="mb-3 font-medium text-foreground">IMPORTANT: Please read this section carefully.</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>No Employment Guarantees:</strong> SyllabusStack provides informational guidance only. We do not guarantee any employment outcomes, job offers, interviews, or career advancement.</li>
                  <li><strong>AI Limitations:</strong> Our analyses are generated by artificial intelligence and may contain errors, inaccuracies, or omissions. AI-generated content should be verified and not relied upon as the sole basis for career decisions.</li>
                  <li><strong>Not Professional Advice:</strong> Our service is not a substitute for professional career counseling, academic advising, or employment services.</li>
                  <li><strong>Market Variability:</strong> Job requirements vary by company, location, and time. Our analyses reflect general patterns and may not match specific employer requirements.</li>
                  <li><strong>Third-Party Content:</strong> We recommend courses and resources from third parties. We are not responsible for the quality, accuracy, or availability of this content.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">4. User Responsibilities</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Content Ownership:</strong> You must have the right to share any content you upload. Do not upload copyrighted materials you do not own or have permission to use.</li>
                  <li><strong>Accuracy:</strong> You are responsible for the accuracy of the information you provide.</li>
                  <li><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials.</li>
                  <li><strong>Appropriate Use:</strong> You agree not to use the Service for any unlawful purpose or in any way that could damage, disable, or impair the Service.</li>
                  <li><strong>No Automation:</strong> You may not use bots, scrapers, or automated tools to access the Service without our written permission.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">5. Intellectual Property</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Your Content:</strong> You retain ownership of content you upload. By uploading, you grant us a license to process this content to provide our services.</li>
                  <li><strong>Our Content:</strong> SyllabusStack, its logo, and all AI-generated analyses, recommendations, and platform features are our intellectual property.</li>
                  <li><strong>Feedback:</strong> Any suggestions or feedback you provide may be used by us without obligation to you.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">6. Limitation of Liability</h3>
                <p className="mb-3">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>SyllabusStack is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied.</li>
                  <li>We disclaim all warranties including merchantability, fitness for a particular purpose, and non-infringement.</li>
                  <li>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</li>
                  <li>We shall not be liable for any loss of profits, data, use, goodwill, or other intangible losses.</li>
                  <li>Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.</li>
                  <li>We are not liable for any career decisions, job applications, or employment outcomes based on our analyses.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">7. Indemnification</h3>
                <p>You agree to indemnify and hold harmless SyllabusStack, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of another party.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">8. Account Termination</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You may delete your account at any time.</li>
                  <li>We may suspend or terminate your account for violations of these Terms.</li>
                  <li>Upon termination, your right to use the Service ceases immediately.</li>
                  <li>Provisions that by their nature should survive termination shall survive.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">9. Modifications</h3>
                <p>We reserve the right to modify these Terms at any time. We will notify users of material changes via email or prominent notice on the Service. Continued use after changes constitutes acceptance.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">10. Governing Law & Disputes</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>These Terms are governed by the laws of the State of Delaware, United States.</li>
                  <li>Any disputes shall be resolved through binding arbitration, except where prohibited by law.</li>
                  <li>Class action lawsuits and class-wide arbitration are waived to the extent permitted by law.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">11. Severability</h3>
                <p>If any provision of these Terms is found unenforceable, the remaining provisions shall remain in full force and effect.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">12. Contact</h3>
                <p>For questions about these Terms, contact us at <a href="mailto:legal@syllabusstack.com" className="underline text-primary">legal@syllabusstack.com</a>.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cookie Policy */}
        <section id="cookies" className="mt-8 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Cookie Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. What Are Cookies</h3>
                <p>Cookies are small text files stored on your device when you visit websites. They help websites remember your preferences and improve your experience.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">2. Cookies We Use</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Essential Cookies:</strong> Required for authentication, session management, and core functionality. These cannot be disabled.</li>
                  <li><strong>Preference Cookies:</strong> Store your settings like dark mode preference, language selection, and notification preferences.</li>
                  <li><strong>Local Storage:</strong> We use browser local storage to persist temporary data like scan results across page navigation.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">3. Third-Party Cookies</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>YouTube Embeds:</strong> When you view embedded YouTube videos, YouTube may set cookies according to their policies.</li>
                  <li><strong>Khan Academy Embeds:</strong> Embedded Khan Academy content may set their own cookies.</li>
                  <li><strong>Stripe:</strong> If using payment features, Stripe may set cookies for fraud prevention.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">4. We Do NOT Use</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Third-party advertising cookies</li>
                  <li>Cross-site tracking cookies</li>
                  <li>Social media tracking pixels</li>
                  <li>Analytics cookies from Google Analytics or similar services</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">5. Managing Cookies</h3>
                <p className="mb-2">You can control cookies through your browser settings. Note that disabling essential cookies may prevent you from using the Service.</p>
                <p>To manage preferences stored in our application, visit your <Link to="/settings" className="underline text-primary">Settings page</Link>.</p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">6. Contact</h3>
                <p>For questions about our cookie practices, contact <a href="mailto:privacy@syllabusstack.com" className="underline text-primary">privacy@syllabusstack.com</a>.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Acceptable Use Policy */}
        <section id="acceptable-use" className="mt-8 scroll-mt-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Acceptable Use Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Prohibited Activities</h3>
                <p className="mb-3">You agree NOT to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Upload content that infringes on intellectual property rights of others</li>
                  <li>Upload malicious files, viruses, or harmful code</li>
                  <li>Attempt to access other users' accounts or data</li>
                  <li>Use the service to harass, abuse, or harm others</li>
                  <li>Attempt to reverse engineer, decompile, or disassemble the Service</li>
                  <li>Use automated scripts, bots, or scrapers without permission</li>
                  <li>Circumvent rate limits or abuse API endpoints</li>
                  <li>Misrepresent your identity or affiliation</li>
                  <li>Use the service for any illegal purpose</li>
                  <li>Resell or redistribute our analyses without permission</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Enforcement</h3>
                <p>Violations may result in warning, suspension, or permanent termination of your account at our sole discretion.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SyllabusStack. All rights reserved.</p>
          <p className="mt-2">
            Questions? Contact <a href="mailto:legal@syllabusstack.com" className="underline text-primary">legal@syllabusstack.com</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
