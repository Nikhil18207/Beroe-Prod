"use client";

import { Loader2 } from "lucide-react";

export default function ReviewLoading() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#F8FBFE]">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#E0F2FE]/40 via-[#F8FBFE] to-white" />
        <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl">
          <div className="absolute inset-0 flex flex-col space-y-8 pt-16">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-[1px] w-full bg-black/5" />
            ))}
          </div>
        </div>
      </div>

      {/* Loading Content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900">Preparing Review</h2>
          <p className="mt-1 text-sm text-gray-500">Loading your data validation tools...</p>
        </div>
      </div>
    </div>
  );
}
