import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// STATIC_EXPORT=1: xuất bản demo tĩnh để chạy trên GitHub Pages tại /crm-demo/
// (chỉ dùng cho bản demo dữ liệu giả lập; bản thật triển khai trên Vercel).
const isStatic = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = isStatic
  ? {
      output: "export",
      basePath: "/crm-demo",
      trailingSlash: true,
      images: { unoptimized: true },
      reactStrictMode: true,
    }
  : {
      reactStrictMode: true,
      poweredByHeader: false,
      async headers() {
        return [{ source: "/(.*)", headers: securityHeaders }];
      },
    };

export default nextConfig;
