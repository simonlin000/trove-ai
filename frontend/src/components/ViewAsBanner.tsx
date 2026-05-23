'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ViewAsBanner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const targetUsername = searchParams.get('username');

  if (!targetUsername || !user?.is_super_admin || targetUsername === user.username) {
    return null;
  }

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('username');
    const qs = params.toString();
    router.push(qs ? `?${qs}` : window.location.pathname);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#fff3cd] border-b border-[#ffc107] text-[#856404] text-sm">
      <span>
        Looking at user <strong className="text-[#664d03]">{targetUsername}</strong>'s data
      </span>
      <button
        onClick={clear}
        className="p-1 rounded hover:bg-[#ffe69c] transition-colors"
        title="Return to my data"
      >
        <X size={14} />
      </button>
    </div>
  );
}
