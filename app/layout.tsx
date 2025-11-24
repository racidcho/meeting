import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '상견례 사진 투표',
  description: '가족들과 함께하는 사진 투표 게임',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

