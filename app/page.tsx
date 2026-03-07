"use client";

import { SignInButton, Show } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { MessageSquare, Zap, Sparkles, Loader2, ChevronLeft } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { useSearchParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Suspense } from "react";

function HomeContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatId = searchParams.get("chat") as Id<"conversations"> | null;
  const storeUser = useMutation(api.users.store);
  const heartbeat = useMutation(api.users.heartbeat);
  const ensureAI = useMutation(api.users.ensureAIUser);
  const offline = useMutation(api.users.offline);

  useEffect(() => {
    if (isAuthenticated) {
      storeUser();
      ensureAI();

      const interval = setInterval(() => heartbeat(), 10000);

      const handleBeforeUnload = () => {
        heartbeat(); // One last update
        offline();
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        clearInterval(interval);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        offline();
      };
    }
  }, [isAuthenticated, storeUser, heartbeat, offline, ensureAI]);

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center themed-bg">
      <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  return (
    <main className="min-h-screen transition-colors duration-200 themed-bg themed-text">
      <Show when="signed-out">
        {/* --- PREMIUM LIGHT LANDING SCREEN --- */}
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 bg-white">
          {/* Subtle Background Glow */}
          <div className="absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-blue-50/50 blur-[120px] rounded-full" />

          <div className="mb-8 flex items-center gap-2 rounded-2xl bg-white p-4 border border-gray-100 shadow-sm backdrop-blur-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3390ec] shadow-lg shadow-blue-500/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Tars Chat AI</span>
          </div>

          <div className="text-center">
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-6xl text-gray-900">
              Real-time messaging <br />
              <span className="text-[#3390ec]">
                meets Local AI.
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-lg text-gray-500">
              Connect with teammates instantly and chat with Tars AI.
              A premium, light-weight experience built for speed.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="group relative flex items-center justify-center">
              <SignInButton mode="modal" fallbackRedirectUrl="/">
                <button className="flex items-center gap-2 rounded-full bg-gray-900 px-8 py-4 font-semibold text-white transition-all hover:bg-gray-800 shadow-xl active:scale-95">
                  Get Started for Free
                  <Zap className="h-4 w-4 transition-transform group-hover:scale-125" />
                </button>
              </SignInButton>
            </div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
              Powered by Convex • Clerk • Ollama
            </p>
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex h-screen overflow-hidden">
          <div className={`
            ${chatId ? "hidden md:flex" : "flex"} 
            w-full md:w-[320px] lg:w-[380px] flex-col z-30
          `}>
            <Sidebar />
          </div>

          {/* Main Chat Area: Mobile Toggle Logic */}
          <div className={`
            ${!chatId ? "hidden md:flex" : "flex"} 
            flex-1 flex-col relative themed-chat-bg
          `}>
            {chatId ? (
              <>
                {/* Mobile Back Button */}
                <button
                  onClick={() => router.push("/")}
                  className="md:hidden absolute top-3 left-3 z-50 h-10 w-10 flex items-center justify-center rounded-full backdrop-blur-sm border shadow-sm active:scale-90 transition-all themed-bg themed-border"
                  style={{ color: 'var(--accent)' }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <ChatWindow conversationId={chatId} />
              </>
            ) : (
              <section className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="rounded-full p-8 mb-6 shadow-xl border themed-bg themed-border">
                  <Sparkles className="h-16 w-16" style={{ color: 'var(--accent)' }} />
                </div>
                <h2 className="text-2xl font-bold themed-text mb-2">Welcome to Tars Chat</h2>
                <p className="themed-text-secondary max-w-sm">
                  Select a contact from the sidebar or search for someone new to start a high-speed conversation.
                </p>
              </section>
            )}
          </div>
        </div>
      </Show>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center themed-bg">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
