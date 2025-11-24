import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold text-gold mb-8">
          상견례 사진 투표 💕
        </h1>
        <div className="space-y-4">
          <Link
            href="/host"
            className="block w-64 mx-auto px-6 py-4 bg-gold text-white rounded-lg text-lg font-semibold hover:bg-opacity-90 transition"
          >
            호스트 시작하기
          </Link>
          <Link
            href="/join"
            className="block w-64 mx-auto px-6 py-4 bg-beige text-gray-800 rounded-lg text-lg font-semibold hover:bg-opacity-90 transition"
          >
            참여하기
          </Link>
        </div>
      </div>
    </div>
  )
}

