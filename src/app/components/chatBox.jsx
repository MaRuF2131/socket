"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";


/* =========================
   API
========================= */

const API = "https://video-streaming-server-5d4s.onrender.com/api";
const TOKEN ="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhM2MxMGZiNWE0Mzc2NGI5OGZkYzdhMyIsIm5hbWUiOiJtZCBtYXJ1ZiBhaG1tZWQiLCJlbWFpbCI6Im1hcnVmQGdtYWlsLmNvbSIsImlhdCI6MTc4MjMyMTQwNCwiZXhwIjoxNzgyOTI2MjA0fQ.kWzu3lpJ2-A5tUl7GiDZE2XcxmAXlJfiD9-rIaxZ7Z8";
async function fetchMessagesAPI(
  chatListId,
  beforeId,
  limit = 30
) {
  const params = new URLSearchParams();
  if (beforeId) params.set("before", beforeId);
  params.set("limit", limit.toString());

  const res = await fetch(`${API}/rooms/messages/${chatListId}?${params}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: TOKEN,
    },
  });
  return res.json();
}

/* =========================
   HELPERS
========================= */

function getTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date().getTime();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  if (diff < 60000) return "এইমাত্র";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}মি আগে`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}ঘ আগে`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}দিন আগে`;
  return new Date(dateStr).toLocaleDateString("bn-BD");
}

/* =========================
   SINGLE MESSAGE ROW
========================= */

function MessageRow( {msg} ) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group flex gap-2.5 p-2.5 rounded-xl hover:bg-zinc-900/70 transition-colors duration-150">
      {/* অবতার */}
      <div className="shrink-0 mt-0.5">
        {msg.messageBy?.photoUrl && !imgError ? (
          <img
            src={msg.messageBy.photoUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-800"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 ring-1 ring-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
            {(msg.messageBy?.name || "U").charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* কন্টেন্ট */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-emerald-400 truncate">
            {msg.messageBy?.name || "Unknown"}
          </span>
          <span className="text-[10px] text-zinc-600 shrink-0">
            {getTimeAgo(msg.createdAt)}
          </span>
        </div>
        <p className="text-[13.5px] text-zinc-200 mt-0.5 leading-relaxed break-words">
          {msg.message}
        </p>
      </div>
    </div>
  );
}

/* =========================
   MAIN CHAT BOX
========================= */

export default function ChatBox({
  chatListId,
  messages,
  setMessages,
  onSendMessage,
  disabled = false,
}) {
    
  /* --- States --- */
  const [input, setInput] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  /* --- Refs --- */
  const containerRef = useRef(null);
  const prevHeightRef = useRef(0);
  const shouldRestoreRef = useRef(false);
  const isFirstLoadRef = useRef(true);
  const fetchingRef = useRef(false);

  /* =========================
     FETCH INITIAL
  ========================= */
  const fetchInitial = useCallback(async () => {
    if (!chatListId) return;

    setLoadingInitial(true);
    isFirstLoadRef.current = true;
    shouldRestoreRef.current = false;
    setHasMore(true);
    setMessages([]);
    setUnreadCount(0);

    try {
      const data = await fetchMessagesAPI(chatListId);
      const msgs = data?.data?.messages || [];
      setMessages(msgs);
      setHasMore(data?.data?.hasMore ?? false);
    } catch (err) {
      console.error("❌ Initial fetch:", err);
      setMessages([]);
      setHasMore(false);
    } finally {
      setLoadingInitial(false);
    }
  }, [chatListId, setMessages]);

  /* chatListId পরিবর্তন হলে রিফেচ */
  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  /* =========================
     FETCH OLDER (স্ক্রল টপ)
  ========================= */
  const fetchOlder = useCallback(async () => {
    if (fetchingRef.current || !hasMore || !chatListId || messages.length === 0)
      return;

    const oldestId = messages[0]?.id;
    if (!oldestId) {
      setHasMore(false);
      return;
    }

    fetchingRef.current = true;
    setLoadingMore(true);
    prevHeightRef.current = containerRef.current?.scrollHeight || 0;

    try {
      const data = await fetchMessagesAPI(chatListId, oldestId);
      const older = data?.data?.messages || [];

      if (older.length === 0) {
        setHasMore(false);
      } else {
        const existIds = new Set(messages.map((m) => m.id));
        const unique = older.filter((m) => !existIds.has(m.id));

        if (unique.length === 0) {
          setHasMore(false);
        } else {
          setMessages((prev) => [...unique, ...prev]);
          shouldRestoreRef.current = true;
          if (!data?.data?.hasMore) setHasMore(false);
        }
      }
    } catch (err) {
      console.error("❌ Older fetch:", err);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, chatListId, messages, setMessages]);

  /* =========================
     SCROLL BEHAVIOR
  ========================= */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || messages.length === 0) return;

    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      if (shouldRestoreRef.current) {
        /* পুরানো মেসেজ লোড → পজিশন রিস্টোর */
        containerRef.current.scrollTop =
          containerRef.current.scrollHeight - prevHeightRef.current;
        shouldRestoreRef.current = false;
      } else if (isAtBottom || isFirstLoadRef.current) {
        /* নতুন মেসেজ + নিচে আছে, বা প্রথম লোড → নিচে যাও */
        containerRef.current.scrollTop =
          containerRef.current.scrollHeight;
        if (isFirstLoadRef.current) isFirstLoadRef.current = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isAtBottom]);

  /* =========================
     UNREAD COUNT
  ========================= */
  useEffect(() => {
    if (!isAtBottom && messages.length > 0 && !loadingInitial) {
      setUnreadCount((p) => p + 1);
    } else if (isAtBottom) {
      setUnreadCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  /* =========================
     SCROLL HANDLER
  ========================= */
  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);

    /*  শুধু একদম টপে গেলে */
    if (scrollTop <= 0 && hasMore && !fetchingRef.current) {
      fetchOlder();
    }
  }, [hasMore, fetchOlder]);

  /* =========================
     SEND
  ========================= */
  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg) return;
    onSendMessage(msg);
    setInput("");
  }, [input, onSendMessage]);

  /* =========================
     SCROLL TO BOTTOM
  ========================= */
  const goBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
    setUnreadCount(0);
  }, []);

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl flex flex-col h-full overflow-hidden relative">
      {/* ─── HEADER ─── */}
      <div className=" shrink-0 px-4 pt-4 pb-2 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="font-bold text-sm text-white">Live Chat</h2>
          {messages.length > 0 && (
            <span className="text-[11px] text-zinc-600 font-medium bg-zinc-900 px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>

        {messages.length > 0 && (
          <button
            onClick={goBottom}
            className="text-[11px] text-zinc-500 hover:text-white transition px-2 py-1 rounded-md hover:bg-zinc-800"
          >
            সর্বশেষ ↓
          </button>
        )}
      </div>

      {/* ─── MESSAGES AREA ─── */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 max-h-96 overflow-y-auto px-2 py-2 space-y-0.5
                   [&::-webkit-scrollbar]:w-[4px]
                   [&::-webkit-scrollbar-track]:bg-transparent
                   [&::-webkit-scrollbar-thumb]:bg-zinc-800
                   [&::-webkit-scrollbar-thumb]:rounded-full
                   scroll-smooth"
      >
        {/* ইনিশিয়াল লোডিং */}
        {loadingInitial && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-zinc-800 rounded-full" />
              <div className="absolute inset-0 w-10 h-10 border-2 border-transparent border-t-emerald-500 rounded-full animate-spin" />
            </div>
            <span className="text-xs text-zinc-600">মেসেজ লোড হচ্ছে...</span>
          </div>
        )}

        {/* পুরানো মেসেজ লোডিং */}
        {loadingMore && (
          <div className="flex items-center justify-center py-3 gap-2.5">
            <div className="w-4 h-4 border-[2px] border-zinc-800 border-t-white rounded-full animate-spin" />
            <span className="text-[11px] text-zinc-600">
              পুরানো মেসেজ লোড হচ্ছে...
            </span>
          </div>
        )}

        {/* সব মেসেজ শেষ */}
        {!hasMore && messages.length > 0 && !loadingMore && (
          <div className="text-center py-2.5">
            <span className="text-[10px] text-zinc-700 bg-zinc-900/80 px-3 py-1 rounded-full inline-block">
              · সব মেসেজ দেখা হয়েছে ·
            </span>
          </div>
        )}

        {/* মেসেজ লিস্ট */}
        {!loadingInitial &&
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)}

        {/* খালি */}
        {!loadingInitial && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-2xl">
              💬
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-600">
                কোনো মেসেজ নেই
              </p>
              <p className="text-xs text-zinc-700 mt-1">
                প্রথম মেসেজ পাঠান!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── SCROLL TO BOTTOM ফ্লোটিং বাটন ─── */}
      {!isAtBottom && messages.length > 0 && !loadingInitial && (
        <button
          onClick={goBottom}
          className="absolute bottom-[72px] right-4 w-10 h-10 rounded-full
                     bg-zinc-800/90 backdrop-blur-md border border-zinc-700/60
                     flex items-center justify-center
                     hover:bg-zinc-700 transition-all duration-200
                     shadow-xl shadow-black/40 z-10
                     active:scale-90"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-300"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>

          {/* আনরিড ব্যাজ */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-lg">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* ─── INPUT AREA ─── */}
      <div className="shrink-0 p-3 border-t border-zinc-800/50 bg-zinc-950">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={disabled || !chatListId}
              placeholder={
                disabled || !chatListId
                  ? "রুমে জয়েন করুন..."
                  : "মেসেজ লিখুন..."
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5
                         text-sm text-white placeholder-zinc-600
                         focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
              maxLength={500}
            />
            {/* ক্যারেক্টার কাউন্ট */}
            {input.length > 0 && (
              <span
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${
                  input.length > 450 ? "text-red-400" : "text-zinc-700"
                }`}
              >
                {input.length}/500
              </span>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled || !chatListId}
            className="shrink-0 bg-white text-black px-5 rounded-xl font-semibold text-sm
                       hover:bg-zinc-200 active:scale-95
                       disabled:opacity-20 disabled:cursor-not-allowed disabled:active:scale-100
                       transition-all duration-150"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}