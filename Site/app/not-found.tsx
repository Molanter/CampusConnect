'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HomeIcon, ChevronLeftIcon, BookOpenIcon, AcademicCapIcon, ComputerDesktopIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

// Floating items configuration
const floatingItems = [
    { icon: BookOpenIcon, color: 'text-blue-400', size: 'w-12 h-12', delay: 0, x: -150, y: -100 },
    { icon: AcademicCapIcon, color: 'text-[#ffb200]', size: 'w-16 h-16', delay: 1, x: 180, y: -80 },
    { icon: ComputerDesktopIcon, color: 'text-purple-400', size: 'w-14 h-14', delay: 2, x: -120, y: 120 },
    { icon: BeakerIcon, color: 'text-green-400', size: 'w-10 h-10', delay: 3, x: 160, y: 90 },
];

export default function NotFound() {
    const router = useRouter();
    const [stars, setStars] = useState<any[]>([]);

    // Mouse parallax effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth physics-based interpolation
    const x = useTransform(mouseX, [-1000, 1000], [-30, 30], { clamp: false });
    const y = useTransform(mouseY, [-1000, 1000], [-30, 30], { clamp: false });

    useEffect(() => {
        // Initialize stars on client only
        setStars(Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random(),
            duration: 3 + Math.random() * 5
        })));

        const handleMouseMove = (e: MouseEvent) => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            animate(mouseX, e.clientX - centerX, { type: 'spring', damping: 50, stiffness: 400 });
            animate(mouseY, e.clientY - centerY, { type: 'spring', damping: 50, stiffness: 400 });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY]);

    return (
        <div className="fixed inset-0 h-screen w-screen text-foreground flex items-center justify-center overflow-hidden font-sans bg-background">

            {/* Animated Stars/Dust */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                {stars.map((star) => (
                    <motion.div
                        key={star.id}
                        className="absolute w-1 h-1 bg-foreground rounded-full"
                        initial={{
                            left: star.left,
                            top: star.top,
                            opacity: star.opacity
                        }}
                        animate={{
                            opacity: [0.2, 0.8, 0.2],
                            scale: [1, 1.5, 1]
                        }}
                        transition={{
                            duration: star.duration,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                ))}
            </div>

            {/* Main Content Container */}
            <motion.div
                className="relative z-10 flex flex-col items-center justify-center max-w-4xl px-4"
                style={{ x, y }}
            >
                {/* Floating Orbit Layer */}
                <div className="absolute inset-0 pointer-events-none">
                    {floatingItems.map((item, i) => (
                        <FloatingItem key={i} {...item} />
                    ))}
                </div>

                {/* Central Gravity: THE 404 */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: "backOut" }}
                    className="relative z-20 mb-8"
                >
                    <h1 className="text-[180px] md:text-[240px] font-black leading-none tracking-tighter select-none relative group">
                        {/* Glow Layer */}
                        <span className="absolute inset-0 text-brand blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                            404
                        </span>

                        {/* Main Text with Gradient */}
                        <span className="bg-gradient-to-br from-foreground via-foreground to-secondary bg-clip-text text-transparent">
                            4
                            <span className="text-brand inline-block relative">
                                0
                                {/* Subtle Planet Ring for the '0' */}
                                <motion.div
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[40%] border border-brand/30 rounded-[100%] z-[-1]"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                />
                            </span>
                            4
                        </span>
                    </h1>
                </motion.div>

                {/* Message */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center space-y-4 mb-12 relative z-30"
                >
                    <h2 className="text-3xl md:text-4xl font-bold">Lost in Campus Orbit?</h2>
                    <p className="text-secondary text-lg md:text-xl max-w-md mx-auto leading-relaxed">
                        The page you're searching for seems to have drifted into the digital void.
                    </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-col sm:flex-row gap-4 relative z-30"
                >
                    <button
                        onClick={() => router.back()}
                        className="group relative px-8 py-4 rounded-full cc-glass border border-secondary/20 hover:border-secondary/30 transition-all hover:bg-secondary/10 shadow-sm"
                    >
                        <div className="flex items-center gap-2 font-medium text-foreground">
                            <ChevronLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                            <span>Go Back</span>
                        </div>
                    </button>

                    <Link
                        href="/"
                        className="group relative px-8 py-4 rounded-full bg-brand text-brand-foreground overflow-hidden hover:shadow-[0_0_20px_rgba(255,178,0,0.4)] transition-shadow"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        <div className="relative flex items-center gap-2 font-bold">
                            <HomeIcon className="h-5 w-5" />
                            <span>Return Home</span>
                        </div>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    );
}

// Sub-component for individual floating items
function FloatingItem({ icon: Icon, color, size, delay, x, y }: any) {
    return (
        <motion.div
            className={`absolute ${color} pointer-events-auto`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
                opacity: 0.8,
                scale: 1,
                x: [x, x + 10, x - 10, x],
                y: [y, y - 20, y + 5, y],
                rotate: [0, 10, -5, 0]
            }}
            transition={{
                opacity: { duration: 1, delay },
                scale: { duration: 1, delay },
                default: {
                    duration: 6,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                    delay: delay * 2
                }
            }}
            // Hover interaction
            whileHover={{ scale: 1.2, rotate: 15, transition: { duration: 0.2 } }}
            style={{
                left: '50%',
                top: '50%',
                marginLeft: x, // Basic positioning relative to center
                marginTop: y
            }}
        >
            <Icon className={`${size}`} strokeWidth={1.5} />
        </motion.div>
    )
}
