import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";

export default function useRoomSocket() {
  const socket = getSocket();

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [currentVideo, setCurrentVideo] = useState(null);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      console.log("✅ socket connected");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("viewer-update", (data) => {
      setViewerCount(data.currentViewers || 0);
    });

    socket.on("like-update", (data) => {
      console.log("❤️ Like update:", data);
      setLikeCount(data.likesCount || 0);
    });

    socket.on("follower-update", (data) => {
      console.log("👥 Follower update:", data);
      setFollowerCount(data.followerCount || 0);
    });

    socket.on("new-message", (msg) => {
      console.log("🔥 NEW MESSAGE:", msg);

      setMessages((prev) => {
        const exists = prev.find((m) => m.id === msg.id);
        if (exists) return prev;
        return [...prev, msg];
      });
    });

    socket.on("video-sync", (data) => {
      console.log("socket back",data);
      
      if (data?.currentVideo) {
        setCurrentVideo(data);
      }
    });

    socket.on("play-next-video", (video) => {
      setCurrentVideo(video);
    });


    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("viewer-update");
      socket.off("new-message");
      socket.off("video-sync");
      socket.off("play-next-video");
      socket.off("like-update");
      socket.off("follower-update");
    };
  }, [socket]);

  // -------------------
  // ACTIONS
  // -------------------

  const joinRoom = (roomId) => {
    console.log("Emitting join room:", { roomId });
    socket.emit("join-room", { roomId });
  };

  const leaveRoom = (roomId) => {
    console.log("Emitting leave room:", { roomId });
    socket.emit("leave-room", { roomId });
  };

  const sendMessage = (roomId, userId, message) => {
    console.log("Emitting message:", { roomId, userId, message });
    socket.emit("send-message", {
      roomId,
      userId,
      message,
    });
  };

  const likeRoom = (rmId, usId) => {
    const roomId=rmId.trim();
    const userId=usId.trim();
    console.log("Emitting like:", { roomId, userId });
    socket.emit("like-room", { roomId, userId });
  };

  const syncVideo = (roomId) => {
    const safeRoomId = roomId.trim();
    console.log("Emitting video sync:", { safeRoomId });
    socket.emit("sync-video", { safeRoomId });
  };

  const videoEnded = (roomId, currentVideoId) => {
    const safeRoomId = roomId.trim();
    const safecurrentVideoId=currentVideoId.trim();
    console.log("Emitting video ended:", { safeRoomId, safecurrentVideoId });
    socket.emit("video-ended", { safeRoomId, safecurrentVideoId });
  };

  return {
    connected,
    messages,
    setMessages,
    viewerCount,
    setViewerCount,
    likeCount,
    setLikeCount,
    followerCount,
    setFollowerCount,
    currentVideo,
    setCurrentVideo,
    joinRoom,
    leaveRoom,
    sendMessage,
    likeRoom,
    syncVideo,
    videoEnded,
  };
}