/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // BACKEND_URL: 서버(Node.js)가 API에 접근하는 주소
    // - 로컬 개발: http://localhost:8000 (Docker 포트 매핑)
    // - Docker 내부: http://api:8000 (컨테이너 간 통신)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/output/:path*", destination: `${backendUrl}/output/:path*` },
      { source: "/temp/:path*", destination: `${backendUrl}/temp/:path*` },
    ];
  },
};

export default nextConfig;
