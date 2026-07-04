"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import useRoomSocket from "../hook/useRoomSocket";
import LiveStreamPage from "./liveVideo";
import ChatBox from "./chatBox";
import VideoList from "./videoList";

const API = "https://video-streaming-server-5d4s.onrender.com/api";

/* =========================
   API
========================= */

async function enterRoom(roomId) {
  const res = await fetch(`${API}/rooms/enter/${roomId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNDdiZTRlNWIyMzQ0MDVjMzdiNDQ1MyIsIm5hbWUiOiJtZCBtYXJ1ZiBhaG1tZWQyMjIiLCJlbWFpbCI6Im1hcnVmMjJAZ21haWwuY29tIiwiaWF0IjoxNzgzMDg2NjcxLCJleHAiOjE3ODM2OTE0NzF9.CXSTV-yoXtWPxIT3qeBu7NNYyGw08sKqjj9hK7hcm_Q",
    },
  });
  return res.json();
}

/* =========================
   COMPONENT
========================= */

export default function RoomPage() {
  const {
    connected,
    viewerCount,
    setViewerCount,
    messages,
    setMessages,
    likeCount,
    setLikeCount,
    followerCount,
    setFollowerCount,
    currentVideo,
    setCurrentVideo,
    joinRoom,
    leaveRoom,
    syncVideo,
    sendMessage,
    likeRoom,
    videoEnded,
  } = useRoomSocket();

  const DEFAULT_ROOM_ID = "6a2c05acf672c6020b6ef522";
  const DEFAULT_USER_ID = "6a2bf666a7a656117135fac0";

  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [currentUserId, setCurrentUserId] = useState(DEFAULT_USER_ID);
  const [roomData, setRoomData] = useState(null);
  const [isJoined, setIsJoined] = useState(false);

  /* =========================
     VALIDATION
  ========================= */
  const isValidId = (id) => id && id.length === 24;

  const canConnect = useMemo(() => {
    return isValidId(roomId.trim()) && isValidId(currentUserId.trim());
  }, [roomId, currentUserId]);


useEffect(() => {
  if (canConnect) {
    handleJoinRoom();
  }
}, [canConnect]);

  /* =========================
     JOIN ROOM
  ========================= */
  const handleJoinRoom = useCallback(async () => {
    const safeRoomId = roomId.trim();
    const safeUserId = currentUserId.trim();

    if (!isValidId(safeRoomId)) return alert("Invalid Room ID");
    if (!isValidId(safeUserId)) return alert("Invalid User ID");

    try {
      const data = await enterRoom(safeRoomId);
      const room = data?.data || null;
      setRoomData(room);

      setLikeCount(room?.likesCount || 0);
      setFollowerCount(room?.followersCount || 0);

      if (!isJoined) {
        joinRoom(safeRoomId);
        syncVideo(safeRoomId); // এটা ব্যাকএন্ডে getCurrentLiveVideo কল করবে
        setIsJoined(true);
      }
    } catch (err) {
      console.error("Join error:", err);
    }
  }, [roomId, currentUserId, isJoined, joinRoom, syncVideo, setLikeCount, setFollowerCount]);

  /* =========================
     LEAVE ROOM
  ========================= */
  const handleLeaveRoom = useCallback(() => {
    const safeRoomId = roomId.trim();
    if (!safeRoomId) return;

    leaveRoom(safeRoomId);
    setIsJoined(false);
    setRoomData(null);
    setMessages([]);
    setLikeCount(0);
    setFollowerCount(0);
    setViewerCount(0);
    setCurrentVideo(null);
  }, [roomId, leaveRoom, setMessages, setLikeCount, setFollowerCount, setViewerCount, setCurrentVideo]);

  /* =========================
     AUTO CLEANUP
  ========================= */
  useEffect(() => {
    return () => {
      if (isJoined && roomId) leaveRoom(roomId.trim());
    };
  }, [isJoined, roomId, leaveRoom]);


    /* =========================
     ✅ AUTO LIVE START LOGIC
  ========================= */
  useEffect(() => {
    // শুধু তখনই কাজ করবে যখন:
    // ১. ইউজার জয়েন করেছে
    // ২. liveStartAt আছে
    // ৩. ভিডিও এখনো চলছে না (currentVideo নেই)
    if (!isJoined || !roomData?.liveStartAt || currentVideo) return;

    const liveStart = new Date(roomData.liveStartAt);
    const now = new Date();

    // যদি সময় পার হয়ে গেয়ে থাকে (কোনো কারণে ভিডিও আসেনি), তাহলে সাথে সাথেই চেক করো
    if (now >= liveStart) {
      console.log("end time");
      
      syncVideo(roomId.trim());
      return;
    }

    // যদি সময় বাকি থাকে, তাহলে ঠিক সেই মিলিসেকেন্ডের জন্য টাইমার সেট করো
    const delay = liveStart.getTime() - now.getTime();
    console.log(`⏳ অটো লাইভ: ${Math.floor(delay / 1000)} সেকেন্ড পর শুরু হবে`);

    const timer = setTimeout(() => {
      console.log("🔴 সময় হয়েছে! ভিডিও সিঙ্ক করা হচ্ছে...");
      syncVideo(roomId.trim());
    }, delay);

    // ক্লিনআপ: ইউজার লিভ করে গেলে বা কম্পোনেন্ট আনমাউন্ট হলে টাইমার বন্ধ করে দাও
    return () => clearTimeout(timer);
  }, [isJoined, roomData?.liveStartAt, currentVideo, roomId]);

  /* =========================
     VIDEO AREA LOGIC (লাইভ ম্যানেজমেন্ট)
  ========================= */
  const renderVideoArea = () => {
    // ১. রুমে জয়েন করা হয়নি
    if (!isJoined) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
          <span className="text-5xl mb-4">🔒</span>
          <p className="text-lg font-medium">রুমে জয়েন করুন ভিডিও দেখতে</p>
        </div>
      );
    }

    const liveStart = roomData?.liveStartAt ? new Date(roomData.liveStartAt) : null;
    const now = new Date();

    // ২. লাইভ শিডিউল সেট করা হয়নি
    if (!liveStart) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
          <span className="text-5xl mb-4">📅</span>
          <p className="text-lg font-medium">লাইভ শিডিউল এখনো সেট করা হয়নি</p>
          <p className="text-sm text-zinc-700 mt-1">হোস্ট যখন সময় নির্ধারণ করবে, তখন এখানে দেখাবে</p>
        </div>
      );
    }

    // ৩. লাইভ এখনো শুরু হয়নি (Live Start Time এর আগে)
    if (now < liveStart) {
      // সময় ফরম্যাট করা
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      const formattedDate = liveStart.toLocaleDateString('bn-BD', options);
      
      return (
        <div className="h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-950 relative overflow-hidden">
          {/* ব্যাকগ্রাউন্ড গ্লো */}
          <div className="absolute w-40 h-40 bg-emerald-500/10 rounded-full blur-[80px]" />
          
          <span className="text-5xl mb-4 relative z-10">⏳</span>
          <p className="text-xl font-bold text-white relative z-10">লাইভ এখনো শুরু হয়নি</p>
          <p className="text-sm text-zinc-500 mt-3 bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800 relative z-10">
            🕒 শুরু হবে: {formattedDate}
          </p>
        </div>
      );
    }

    // ৪. লাইভ শুরু হয়ে গেছে কিন্তু কোনো ভিডিও পাওয়া যায়নি (ব্যাকএন্ড থেকে null এসেছে)
    if (!currentVideo?.currentVideo.videoUrl) {
      console.log("currentVideo",currentVideo);
      
      return (
        <div className="h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
          <div className="w-10 h-10 border-2 border-zinc-700 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-lg font-medium">লাইভ লোড হচ্ছে...</p>
        </div>
      );
    }

    // ৫. সব ঠিক আছে, ভিডিও প্লে করো
    return (
      <LiveStreamPage 
        key={currentVideo?.currentVideo.id}
        url={currentVideo?.currentVideo.videoUrl}
        startTime={currentVideo.currentSecond || 0}
        onEnded={() => {
          if (roomId && currentVideo?.currentVideo.id) {
            videoEnded(roomId.trim(), currentVideo?.currentVideo?.id.trim());
          }
        }} 
      />
    );
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-5 bg-black text-white min-h-screen">

      {/* =====================
          LEFT SIDE (ভিডিও প্লেয়ার)
      ===================== */}
      <div className="space-y-5 relative">

        {/* HEADER */}
        <div className="bg-transparent p-5 absolute inset-0 z-50">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">
                {roomData?.title || "No Room"}
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                {roomData?.category || "Live Stream"}
              </p>
            </div>

            <div className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ml-3 ${
              connected && roomData?.liveStartAt && new Date(roomData.liveStartAt) <= new Date() 
                ? "bg-green-500" 
                : "bg-red-500"
            }`}>
              {/* হেডারেও লাইভ আপকামিং দেখাবে */}
              {connected && roomData?.liveStartAt && new Date(roomData.liveStartAt) <= new Date() 
                ? "🔴 LIVE" 
                : "OFFLINE"
              }
            </div>
          </div>

          <div className="flex gap-3 mt-4 text-sm flex-wrap">
            <span className="bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-800">
              👁 {viewerCount}
            </span>
            <span className="bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-800">
              ❤️ {likeCount}
            </span>
            <span className="bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-800">
              👥 {followerCount}
            </span>
          </div>
        </div>

        {/* VIDEO AREA */}
        <div className="absolute inset-0 z-30 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="aspect-video">
            {renderVideoArea()}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 z-[100] absolute bottom-0">
          <button
            onClick={() => likeRoom(roomId.trim(), currentUserId)}
            className="bg-red-500 hover:bg-red-600 transition px-5 py-2.5 rounded-lg font-medium"
          >
            ❤️ Like
          </button>
          <button
            onClick={handleLeaveRoom}
            className="bg-yellow-500 hover:bg-yellow-600 transition text-black px-5 py-2.5 rounded-lg font-medium"
          >
            Leave
          </button>
        </div>
      </div>

      {/* =====================
          RIGHT SIDE (চ্যাট ও অন্যান্য)
      ===================== */}
      <div className="space-y-5">
        
        {/* CHAT BOX */}
        <div className="h-[450px]">
          <ChatBox
            chatListId={roomData?.chatList?.id}
            messages={messages}
            setMessages={setMessages}
            onSendMessage={(msg) => {
              sendMessage(roomId.trim(), currentUserId, msg);
            }}
            disabled={!isJoined}
          />
        </div>

        {/* VIDEO LIST (✅ ঠিক করা হয়েছে currentVideoId={currentVideo?.id}) */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 h-[250px]">
          <VideoList
            roomId={roomData?.id}
            currentVideoId={currentVideo?.id} 
          />
        </div>

        {/* INPUTS */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <input
            value={roomId || "6a2c05acf672c6020b6ef522"}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
            className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
          />
          <input
            value={currentUserId || "6a2bf666a7a656117135fac0"}
            onChange={(e) => setCurrentUserId(e.target.value)}
            placeholder="User ID"
            className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-sm focus:outline-none focus:border-zinc-600"
          />
          <button
            onClick={handleJoinRoom}
            disabled={!canConnect}
            className="w-full bg-white text-black p-3 rounded-lg font-bold disabled:opacity-30 hover:bg-zinc-200 transition"
          >
            Join Room
          </button>
        </div>

      </div>
    </div>
  );
}