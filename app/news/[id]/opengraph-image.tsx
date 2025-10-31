import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const alt = 'SS Super League News'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'
 
export default async function Image({ params }: { params: { id: string } }) {
  try {
    // Fetch the news article
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/news?limit=100`)
    const data = await response.json()
    const news = data.news?.find((n: any) => n.id === params.id)
    
    if (news && news.image_url) {
      // If news has image, redirect to it
      return new Response(null, {
        status: 302,
        headers: {
          Location: news.image_url,
        },
      })
    }
    
    // Fallback: Generate a text-based OG image
    const title = news?.title_en || news?.title || 'SS Super League News'
    
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 60,
            background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            padding: '80px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 80, fontWeight: 'bold', marginBottom: 20 }}>⚽</div>
          <div style={{ fontWeight: 'bold', marginBottom: 20 }}>{title}</div>
          <div style={{ fontSize: 30, opacity: 0.9 }}>SS Super League</div>
        </div>
      ),
      {
        ...size,
      }
    )
  } catch (error) {
    // Fallback OG image
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 60,
            background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          SS Super League News
        </div>
      ),
      {
        ...size,
      }
    )
  }
}
