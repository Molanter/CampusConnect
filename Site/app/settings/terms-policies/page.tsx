"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { SettingsFooter } from "@/components/settings-footer";

export default function TermsPoliciesPage() {
    const pathname = usePathname();

    // Ensure page always loads at the top with multiple attempts
    useEffect(() => {
        // Immediate scroll
        window.scrollTo(0, 0);

        // Delayed scroll to handle any layout shifts
        const timeoutId = setTimeout(() => {
            window.scrollTo(0, 0);
        }, 100);

        return () => clearTimeout(timeoutId);
    }, []);

    // Scroll to top when pathname changes (navigation occurs)
    useEffect(() => {
        if (pathname === '/settings/terms-policies') {
            window.scrollTo(0, 0);

            // Also try with a small delay for client-side navigation
            const timeoutId = setTimeout(() => {
                window.scrollTo(0, 0);
            }, 50);

            return () => clearTimeout(timeoutId);
        }
    }, [pathname]);

    return (
        <div className="min-h-screen bg-background pb-20">
            <main className="mx-auto max-w-2xl px-4 pb-8">
                <div className="sticky top-0 z-40 -mx-4 px-4 pt-4 pb-4 pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <Link
                            href="/settings"
                            className="flex h-10 w-10 items-center justify-center rounded-full cc-header-btn active:scale-95 transition-all shrink-0"
                        >
                            <ChevronLeftIcon className="h-5 w-5 text-foreground" />
                        </Link>
                        <div className="flex items-center rounded-full cc-glass px-6 py-2.5 shadow-sm">
                            <h1 className="text-sm font-bold text-foreground">Terms & Policies</h1>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Introduction */}
                    <div className="cc-section rounded-3xl p-6 md:p-8 space-y-4">
                        <h2 className="text-2xl font-bold text-foreground">CampusConnect Terms & Policies</h2>
                        <p className="text-[15px] leading-relaxed text-foreground/90">
                            Welcome to CampusConnect. By using our platform, you agree to these terms and policies.
                            Please read them carefully to understand your rights and responsibilities.
                        </p>
                        <p className="text-[13px] text-secondary italic">
                            Last updated: January 2026
                        </p>
                    </div>

                    {/* Terms of Service */}
                    <div className="space-y-6">
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                1. Terms of Service
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    By accessing CampusConnect, you agree to use the platform responsibly and in accordance
                                    with all applicable laws. You must be at least 13 years old to use our services.
                                </p>
                                <p>
                                    You are responsible for maintaining the confidentiality of your account credentials and
                                    for all activities that occur under your account. Notify us immediately of any unauthorized use.
                                </p>
                                <p>
                                    We reserve the right to modify, suspend, or discontinue any part of our service at any time
                                    without prior notice.
                                </p>
                            </div>
                        </div>

                        {/* Privacy Policy */}
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                2. Privacy Policy
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    <span className="font-semibold text-foreground">Data Collection:</span> We collect information
                                    you provide when creating an account, posting content, and interacting with the platform.
                                    This includes your name, email, campus affiliation, and user-generated content.
                                </p>
                                <p>
                                    <span className="font-semibold text-foreground">Data Usage:</span> Your data is used to provide
                                    and improve our services, personalize your experience, and communicate important updates.
                                    We do not sell your personal information to third parties.
                                </p>
                                <p>
                                    <span className="font-semibold text-foreground">Data Security:</span> We implement industry-standard
                                    security measures to protect your data. However, no method of transmission over the internet
                                    is 100% secure, and we cannot guarantee absolute security.
                                </p>
                                <p>
                                    <span className="font-semibold text-foreground">Your Rights:</span> You have the right to access,
                                    update, or delete your personal information at any time through your account settings.
                                </p>
                            </div>
                        </div>

                        {/* Content Guidelines */}
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                3. Content & Conduct Policy
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    You retain ownership of content you post on CampusConnect. By posting, you grant us a
                                    non-exclusive, worldwide license to use, display, and distribute your content on the platform.
                                </p>
                                <p>
                                    You agree not to post content that is illegal, harmful, threatening, abusive, harassing,
                                    defamatory, or otherwise objectionable. This includes but is not limited to hate speech,
                                    explicit content, spam, or misinformation.
                                </p>
                                <p>
                                    We reserve the right to remove any content and suspend or terminate accounts that violate
                                    these policies. Repeat violations may result in permanent bans.
                                </p>
                            </div>
                        </div>

                        {/* Intellectual Property */}
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                4. Intellectual Property
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    All CampusConnect branding, logos, designs, and platform features are protected by copyright,
                                    trademark, and other intellectual property laws. You may not use our intellectual property
                                    without explicit written permission.
                                </p>
                                <p>
                                    Respect the intellectual property rights of others. Do not post content that infringes on
                                    copyrights, trademarks, or other proprietary rights.
                                </p>
                            </div>
                        </div>

                        {/* Limitation of Liability */}
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                5. Limitation of Liability
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    CampusConnect is provided "as is" without warranties of any kind. We do not guarantee that
                                    the service will be uninterrupted, error-free, or secure.
                                </p>
                                <p>
                                    To the fullest extent permitted by law, we shall not be liable for any indirect, incidental,
                                    special, or consequential damages arising from your use of the platform.
                                </p>
                            </div>
                        </div>

                        {/* Changes to Terms */}
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                6. Changes to Terms
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    We may update these terms and policies from time to time. We will notify you of significant
                                    changes via email or through the platform. Your continued use of CampusConnect after such
                                    changes constitutes acceptance of the updated terms.
                                </p>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="cc-section rounded-3xl p-6 md:p-8">
                            <h3 className="mb-3 text-lg font-bold text-foreground">
                                7. Contact Us
                            </h3>
                            <div className="text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30 space-y-3">
                                <p>
                                    If you have questions about these terms and policies, please{" "}
                                    <Link
                                        href="/settings/help-support"
                                        className="font-semibold text-brand hover:underline"
                                    >
                                        visit our Help & Support page
                                    </Link>
                                    {" "}to get in touch with us.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Acknowledgment */}
                    <div className="text-center px-6">
                        <p className="font-medium text-foreground/60 italic">
                            By using CampusConnect, you acknowledge that you have read and understood these terms and policies.
                        </p>
                    </div>

                    {/* Footer */}
                    <SettingsFooter />
                </div>
            </main>
        </div>
    );
}
