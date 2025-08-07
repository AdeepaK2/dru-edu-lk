export async function GET(): Promise<Response> {
  const robotsTxt = `User-agent: *
Allow: /

# Allow all crawlers access to sitemaps
Sitemap: https://drueducation.com.au/sitemap.xml
Sitemap: https://drueducation.com/sitemap.xml

# Disallow admin and private areas
Disallow: /admin/
Disallow: /student/
Disallow: /teacher/
Disallow: /api/

# Allow important pages
Allow: /
Allow: /about
Allow: /courses
Allow: /schedule
Allow: /books
Allow: /test-study
Allow: /consult
Allow: /enroll

# Crawl-delay (optional - be respectful to servers)
Crawl-delay: 1`

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
