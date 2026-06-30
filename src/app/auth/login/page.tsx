"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#fff8f7]">
      <div className="w-full max-w-[320px] flex flex-col items-center gap-8">
        {/* 로고 */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-6xl">🍅</span>
          <h1 className="text-3xl font-bold text-tomato tracking-tight">또마또</h1>
          <p className="text-sm text-zinc-500 text-center leading-relaxed">
            오늘 뭐 먹었는지 기록하고<br />Threads에 자동으로 올려요
          </p>
        </div>

        {/* 로그인 버튼 */}
        <div className="w-full flex flex-col gap-3">
          {error && (
            <p className="text-xs text-red-500 text-center">
              로그인 중 오류가 발생했어요. 다시 시도해주세요.
            </p>
          )}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 h-12 bg-white border border-zinc-200 rounded-xl text-[15px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
        </div>

        <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
          로그인하면 서비스 이용약관 및<br />개인정보 처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
