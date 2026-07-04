"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export default function LiveStreamPage({ url, onEnded, startTime }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [viewers] = useState(1247);
  const toastTimer = useRef(null);

  // মিউট টগল
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
    setToastMsg(next ? "মিউট করা হয়েছে" : "আনমিউট করা হয়েছে");
    setShowToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 1500);
  }, [isMuted]);

  // ভিডিও লোড হলে লোডিং লুকাও
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onCanPlay = () => setIsLoaded(true);
    v.addEventListener("canplay", onCanPlay);
    if (v.readyState >= 3) setIsLoaded(true);
    return () => v.removeEventListener("canplay", onCanPlay);
  }, []);

  // সব কীবোর্ড শর্টকাট ব্লক
  useEffect(() => {
    const block = (e) => {
      const blocked = [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "m", "M", "k", "K", "f", "F", "j", "J", "l", "L"];
      if (blocked.includes(e.key)) {
        if (e.key === "m" || e.key === "M") toggleMute();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [toggleMute]);

  /* =========================
     ✅ পারফেক্ট ফোর্স প্লে (রেস কন্ডিশন ফিক্স সহ)
  ========================= */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const forcePlay = () => {
      // গুরুত্বপূর্ণ: যদি ভিডিও এই মুহূর্তে সিক (জাম্প) করছে, তাহলে প্লে করবো না
      // সিক শেষ হলে নিচের ইফেক্টটা প্লে করে দেবে
      if (v.seeking) return; 
      
      if (v.paused) {
        v.play().catch(() => {});
      }
    };

    v.addEventListener("pause", forcePlay);
    v.addEventListener("ended", forcePlay);

    return () => {
      v.removeEventListener("pause", forcePlay);
      v.removeEventListener("ended", forcePlay);
    };
  }, []);

  /* =========================
     ✅ সিক করে প্লে করার ক্লিন ইফেক্ট
  ========================= */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const startPlayback = () => {
      // যদি ভিডিও ইতিমধ্যে চলতে থাকে, তাহলে আর নতুন করে প্লে করার দরকার নেই (স্ট্রিক্ট মোড ফিক্স)
      if (!v.paused && v.currentTime > 0) return;

      if (startTime > 0) {
        // সিক শেষ হওয়ার জন্য 'seeked' ইভেন্ট আগে ধরে রাখলাম
        const onSeeked = () => {
          v.play().catch(() => {});
          v.removeEventListener("seeked", onSeeked); // একবার কাজ করলে রিমুভ করে দিলাম
        };
        v.addEventListener("seeked", onSeeked);
        
        // এখন টাইম সেট করলাম
        v.currentTime = startTime;
      } else {
        v.play().catch(() => {});
      }
      
      setIsLoaded(true);
    };

    // ডুপ্লিকেট কোড এড়ানোর জন্য একটাই ফাংশনে রেখে দুই জায়গায় কল করা হয়েছে
    v.addEventListener("canplay", startPlayback);
    if (v.readyState >= 3) {
      startPlayback();
    }

    return () => {
      v.removeEventListener("canplay", startPlayback);
    };
  }, [url, startTime]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed w-[500px] h-[500px] rounded-full bg-red-600 opacity-[0.04] blur-[150px] -top-48 -left-24 pointer-events-none" />
      <div className="fixed w-[500px] h-[500px] rounded-full bg-blue-600 opacity-[0.04] blur-[150px] -bottom-48 -right-24 pointer-events-none" />

      <div className="mb-6 text-center z-10">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
          🔴 Live Stream
        </h1>
      </div>

      <div
        className="relative w-full max-w-[960px] aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/[0.06] z-10 select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={videoRef}
          onEnded={onEnded}
          className="w-full h-full object-cover block"
          src={url}
          autoPlay
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
        />

        {/* লোডিং ওভারলে */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 transition-opacity duration-500 ${
            isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="w-10 h-10 border-[3px] border-white/15 border-t-red-600 rounded-full animate-spin" />
          <p className="mt-3.5 text-[13px] text-white/60 font-medium">
            লাইভ স্ট্রিম লোড হচ্ছে...
          </p>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-[5]" />

        {/* LIVE ব্যাজ */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg z-10 pointer-events-none">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider uppercase">LIVE</span>
        </div>

        {/* ভিউয়ার কাউন্ট */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[12px] font-medium z-10 pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {viewers.toLocaleString("en-BD")}
        </div>

        {/* মিউট টোস্ট */}
        <div
          className={`absolute bottom-[76px] right-4 bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg text-[13px] font-medium z-10 pointer-events-none transition-all duration-300 ${
            showToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          {toastMsg}
        </div>

        {/* মিউট বাটন */}
        <button
          onClick={toggleMute}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-black/55 backdrop-blur-xl text-white flex items-center justify-center z-10 transition-all duration-200 hover:bg-white/20 hover:scale-110 active:scale-95 outline-none focus:ring-2 focus:ring-white/30"
          aria-label={isMuted ? "আনমিউট করুন" : "মিউট করুন"}
        >
          {isMuted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
      </div>
    </main>
  );
}