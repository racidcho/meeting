'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRoomByCode } from '@/lib/utils';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('방 코드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const room = await getRoomByCode(code.trim());
      
      if (!room) {
        setError('방을 찾을 수 없습니다.');
        return;
      }

      router.push(`/room/${code.trim()}/vote`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-3xl font-bold text-center text-gold mb-8">
          참여하기
        </h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              방 코드 입력
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: 9234"
              className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-gold focus:outline-none"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={6}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={loading || !code.trim()}
            className="w-full px-6 py-4 bg-gold text-white rounded-lg text-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {loading ? '확인 중...' : '참여하기'}
          </button>
          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

