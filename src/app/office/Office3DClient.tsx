'use client';

import dynamic from 'next/dynamic';

const Office3D = dynamic(() => import('@/components/Office3D/Office3D'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
      <p className="text-white text-lg">Loading 3D Office...</p>
    </div>
  ),
});

export default function Office3DClient() {
  return <Office3D />;
}
