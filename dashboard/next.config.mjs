/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // BACKEND_URL: address the server (Node.js) uses to reach the API
    // - Local dev: http://localhost:8000 (Docker port mapping)
    // - Inside Docker: http://api:8000 (container-to-container)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/output/:path*", destination: `${backendUrl}/output/:path*` },
      { source: "/temp/:path*", destination: `${backendUrl}/temp/:path*` },
    ];
  },
};

export default nextConfig;
