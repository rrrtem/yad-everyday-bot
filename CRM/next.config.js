/** @type {import('next').NextConfig} */
const nextConfig = {
  // Убираем static export для корректной работы API routes
  // output: 'export',
  trailingSlash: false, // Отключаем trailing slash
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig 