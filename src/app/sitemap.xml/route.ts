export async function GET(): Promise<Response> {
  const baseUrl = 'https://drueducation.com.au'
  const alternateUrl = 'https://drueducation.com'
  const currentDate = new Date().toISOString()
  
  const routes = [
    { url: '', priority: '1.0', changefreq: 'weekly' },
    { url: '/about', priority: '0.8', changefreq: 'monthly' },
    { url: '/courses', priority: '0.9', changefreq: 'weekly' },
    { url: '/schedule', priority: '0.8', changefreq: 'weekly' },
    { url: '/books', priority: '0.7', changefreq: 'weekly' },
    { url: '/test-study', priority: '0.7', changefreq: 'weekly' },
    { url: '/consult', priority: '0.6', changefreq: 'monthly' },
    { url: '/enroll', priority: '0.9', changefreq: 'weekly' },
    { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { url: '/terms', priority: '0.3', changefreq: 'yearly' },
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${routes.map(route => `  <url>
    <loc>${baseUrl}${route.url}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${alternateUrl}${route.url}" />
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  })
}
