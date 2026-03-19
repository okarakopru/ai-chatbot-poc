/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/beril-hediye-bul",
        destination: "https://gift-picker.vercel.app",
        permanent: true,
      },
      {
        source: "/gift-picker",
        destination: "https://gift-picker.vercel.app",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
