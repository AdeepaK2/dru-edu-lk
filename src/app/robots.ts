import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/courses',
          '/schedule',
          '/books',
          '/test-study',
          '/consult',
          '/enroll'
        ],
        disallow: [
          '/admin/',
          '/student/',
          '/teacher/',
          '/api/'
        ]
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/about',
          '/courses',
          '/schedule',
          '/books',
          '/test-study',
          '/consult',
          '/enroll'
        ],
        disallow: [
          '/admin/',
          '/student/',
          '/teacher/',
          '/api/'
        ]
      }
    ],
    sitemap: [
      'https://drueducation.com.au/sitemap.xml',
      'https://drueducation.com/sitemap.xml'
    ],
    host: 'https://drueducation.com.au'
  }
}
