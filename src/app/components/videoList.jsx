"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const API = "https://video-streaming-server-5d4s.onrender.com/api";
const TOKEN ="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhM2MxMGZiNWE0Mzc2NGI5OGZkYzdhMyIsIm5hbWUiOiJtZCBtYXJ1ZiBhaG1tZWQiLCJlbWFpbCI6Im1hcnVmQGdtYWlsLmNvbSIsImlhdCI6MTc4MjMyMTQwNCwiZXhwIjoxNzgyOTI2MjA0fQ.kWzu3lpJ2-A5tUl7GiDZE2XcxmAXlJfiD9-rIaxZ7Z8";

/* =========================
   API
========================= */

async function fetchVideosAPI(roomId, cursor, limit = 10) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", limit.toString());

  const res = await fetch(`${API}/rooms/${roomId}/videos?${params}`, {
    method:"GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: TOKEN,
    },
  });
  /* console.log("ttttt",await res.json()); */
  
  return  res.json();
}

/* =========================
   HELPERS
========================= */
function formatDuration(seconds) {
  if (!seconds) return null;
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ✅ ভিডিও URL থেকে Cloudinary তে অটো থাম্বনেইল বানানোর ট্রিক
function getVideoThumbnail(videoUrl) {
  if (!videoUrl) return null;
  
  // চেক করো URL টা Cloudinary কি না
  if (videoUrl.includes("res.cloudinary.com") && videoUrl.includes("/video/upload/")) {
    // /video/upload/ এর পর যোগ করো: so_5 (5 সেকেন্ড পরের ফ্রেম), w_160,h_90,c_thumb (সাইজ)
    // এবং .mp4 কে .jpg তে পরিবর্তন করে দাও
    return videoUrl
      .replace("/video/upload/", "/video/upload/so_5,w_160,h_90,c_thumb/")
      .replace(/\.(mp4|webm|mov)$/, ".jpg");
  }
  
  return null; // Cloudinary না হলে null রিটার্ন করবে
}

/* =========================
   SINGLE LIST ITEM 
========================= */

function VideoListItem({ video, index, isCurrent }) {
  // অটো থাম্বনেইল বের করা হচ্ছে
  const thumbnail = getVideoThumbnail(video.videoUrl);

  return (
    <div
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors duration-200 ${
        isCurrent
          ? "bg-emerald-500/10 border border-emerald-500/30"
          : "bg-zinc-900/40 border border-transparent"
      }`}
    >
      {/* নম্বর / NOW PLAYING অ্যানিমেশন */}
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden">
        {isCurrent ? (
          <>
            <div className="absolute inset-0 bg-emerald-500/20" />
            <div className="flex items-end gap-[2px] h-3.5 relative z-10">
              <span className="w-[2.5px] bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_infinite]" />
              <span className="w-[2.5px] bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.15s_infinite]" />
              <span className="w-[2.5px] bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.3s_infinite]" />
              <span className="w-[2.5px] bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.45s_infinite]" />
            </div>
          </>
        ) : (
          <span className="text-zinc-600 text-xs font-medium">
            {index + 1}
          </span>
        )}
      </div>

      {/* ✅ থাম্বনেইল (ভিডিও থেকে অটো জেনারেট হবে) */}
      <div className="shrink-0 w-16 h-10 rounded-md bg-zinc-800 overflow-hidden relative">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy" // পারফরম্যান্সের জন্য lazy load
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
        
        {/* ডিউরেশন ব্যাজ থাম্বনেইলে */}
        {video.videoDuration && !isCurrent && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] text-zinc-300 px-1 rounded font-mono">
            {formatDuration(video.videoDuration)}
          </span>
        )}
      </div>

      {/* টাইটেল ও স্ট্যাটাস */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] truncate font-medium ${
            isCurrent ? "text-emerald-400" : "text-zinc-300"
          }`}
        >
          {video.title || `ভিডিও ${index + 1}`}
        </p>
        
        <p className="text-[10px] mt-0.5 font-medium">
          {isCurrent ? (
            <span className="text-emerald-500/80">▶ এখন চলছে</span>
          ) : (
            <span className="text-zinc-600">আসন্ন</span>
          )}
        </p>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */

export default function VideoList({ roomId, currentVideoId }) {
  /* ─── States ─── */
  const [videos, setVideos] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /* ─── Refs ─── */
  const listRef = useRef(null);
  const fetchingRef = useRef(false);

  /* =========================
     FETCH INITIAL
  ========================= */
  const fetchInitial = useCallback(async () => {
    if (!roomId) return;
    fetchingRef.current = true;
    setLoadingInitial(true);

    try {
      const data = await fetchVideosAPI(roomId);
      console.log("data",data);
      
      const vids = data?.data?.videos || [];
      console.log("data2",vids);
      setVideos(vids);
      setNextCursor(data?.data?.nextCursor || null);
      setHasMore(data?.data?.hasMore ?? false);
    } catch (err) {
      console.error("❌ Video init error:", err);
    } finally {
      setLoadingInitial(false);
      fetchingRef.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  /* =========================
     FETCH MORE (স্ক্রল করলে)
  ========================= */
  const fetchMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore || !roomId || !nextCursor) return;
    fetchingRef.current = true;
    setLoadingMore(true);

    try {
      const data = await fetchVideosAPI(roomId, nextCursor);
      const newVids = data?.data?.videos || [];

      if (newVids.length === 0) {
        setHasMore(false);
      } else {
        setVideos((prev) => [...prev, ...newVids]);
        setNextCursor(data?.data?.nextCursor || null);
        if (!data?.data?.hasMore) setHasMore(false);
      }
    } catch (err) {
      console.error("❌ Video fetch more error:", err);
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, roomId, nextCursor]);

  /* =========================
     LIST SCROLL HANDLER
  ========================= */
  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;

    if (scrollHeight - scrollTop - clientHeight < 100) {
      fetchMore();
    }
  }, [fetchMore]);

  /* =========================
     AUTO SCROLL: যে ভিডিওটা চলছে লিস্টে সেটাতে ফোকাস আসবে
  ========================= */
  useEffect(() => {
    if (!currentVideoId || !listRef.current) return;
    
    const el = document.getElementById(`vid-${currentVideoId}`);
    if (el) {
      const listRect = listRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      
      // যদি ভিডিওটা দেখা না যায় (লুকানো থাকে), তাহলে স্ক্রল করো
      if (elRect.top < listRect.top || elRect.bottom > listRect.bottom) {
        const offset = elRect.top - listRect.top + listRef.current.scrollTop - 10;
        listRef.current.scrollTo({ top: offset, behavior: "smooth" });
      }
    }
  }, [currentVideoId]);

  /* =========================
     RENDER
  ========================= */

  if (loadingInitial) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">প্লেলিস্ট লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded-xl">
        <div className="text-center text-zinc-600">
          <span className="text-3xl block mb-2">📋</span>
          <p className="text-sm font-medium">কোনো ভিডিও নেই</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          প্লেলিস্ট
        </h3>
        {currentVideoId && (
          <span className="text-[10px] text-zinc-600 font-medium">
            {videos.findIndex((v) => v.id === currentVideoId) + 1} / {videos.length}
            {hasMore ? "+" : ""}
          </span>
        )}
      </div>

      {/* ─── ভিডিও লিস্ট ─── */}
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="flex-1 overflow-y-auto pl-1 pr-0.5 space-y-1
                   [&::-webkit-scrollbar]:w-[3px]
                   [&::-webkit-scrollbar-track]:bg-transparent
                   [&::-webkit-scrollbar-thumb]:bg-zinc-800
                   [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {videos.map((video, idx) => (
          <div key={video.id} id={`vid-${video.id}`}>
            <VideoListItem
              video={video}
              index={idx}
              isCurrent={video.id === currentVideoId}
            />
          </div>
        ))}

        {loadingMore && (
          <div className="flex items-center justify-center py-4 gap-2">
            <div className="w-3.5 h-3.5 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
            <span className="text-[10px] text-zinc-600">
              ভিডিও লোড হচ্ছে...
            </span>
          </div>
        )}

        {!hasMore && videos.length > 0 && !loadingMore && (
          <div className="text-center py-3">
            <span className="text-[9px] text-white bg-zinc-900/80 px-2.5 py-0.5 rounded-full">
              · সব ভিডিও লোড হয়েছে ·
            </span>
          </div>
        )}
      </div>
    </div>
  );
}