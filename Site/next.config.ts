import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Hosting with Cloud Functions supports full Next.js
  // No need for static export - API routes and dynamic pages work!
  reactStrictMode: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/admin/universities/:path*',
        destination: '/admin/campuses/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://www.googleapis.com https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://firebase.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com;",
              "connect-src 'self' https://www.googleapis.com https://firestore.googleapis.com https://*.googleapis.com https://maps.googleapis.com https://maps.gstatic.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebase.googleapis.com wss://*.googleapis.com https://us-central1-campus-vibes-e34f0.cloudfunctions.net;",
              "worker-src 'self' blob:;",
              "child-src 'self' blob: https://accounts.google.com https://campus-vibes-e34f0.firebaseapp.com;",
              "frame-src 'self' https://accounts.google.com https://campus-vibes-e34f0.firebaseapp.com https://www.google.com https://maps.google.com;",
              "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://firebasestorage.googleapis.com https://*.googleapis.com;",
              "object-src 'none';",
              "base-uri 'self';",
            ].join(" "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;