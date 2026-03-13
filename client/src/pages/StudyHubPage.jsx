import { Bot, Copy, Link2, Mic, Send, Sparkles, Users, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chatApi } from "../api/client";
import { fallbackChat } from "../data/demoData";

function toRoomCode(targetRoom) {
  const base = String(targetRoom?.name || targetRoom?._id || "LAKSHYA").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `${base}LAKSHYA`.slice(0, 6);
}

function StudyHubPage() {
  const [room, setRoom] = useState(fallbackChat.rooms[0]);
  const [rooms, setRooms] = useState(fallbackChat.rooms);
  const [messages, setMessages] = useState(fallbackChat.messages);
  const [members] = useState(fallbackChat.members);
  const [draft, setDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState("");
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const micStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const roomCode = useMemo(() => toRoomCode(room), [room]);
  const inviteLink = useMemo(() => {
    const origin = window.location.origin;
    return `${origin}/app/hub?room=${encodeURIComponent(room?._id || "")}&code=${roomCode}`;
  }, [room, roomCode]);

  useEffect(() => {
    chatApi
      .listRooms()
      .then((data) => {
        if (data.rooms?.length) {
          setRooms(data.rooms);
        }

        const searchParams = new URLSearchParams(window.location.search);
        const invitedRoomId = searchParams.get("room");
        const invitedCode = searchParams.get("code")?.trim().toUpperCase();

        const initialRoom = data.rooms.find((roomItem) => {
          if (invitedRoomId && roomItem._id === invitedRoomId) {
            return true;
          }

          return invitedCode ? toRoomCode(roomItem) === invitedCode : false;
        }) || data.rooms[0];

        if (initialRoom) {
          setRoom(initialRoom);
          return chatApi.roomMessages(initialRoom._id);
        }
        return null;
      })
      .then((messageData) => {
        if (messageData?.messages) {
          setMessages(messageData.messages);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function sendMessage() {
    if (!draft.trim()) {
      return;
    }

    const optimistic = {
      _id: `draft-${Date.now()}`,
      user: { name: "You" },
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: draft
    };

    setMessages((current) => [...current, optimistic]);
    setDraft("");

    try {
      const data = await chatApi.sendMessage(room._id, { text: optimistic.text });
      setMessages(data.messages);
    } catch {}
  }

  async function inviteByEmail() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setNotice("Enter an email to send an invite.");
      return;
    }

    try {
      await chatApi.inviteByEmail(room._id, { email });
      setInviteEmail("");
      setNotice("Invite sent.");
    } catch {
      setNotice("Unable to send invite right now. Please try again.");
    }
  }

  function openWhatsAppInvite() {
    const message = `Join my Lakshya Study Room: ${inviteLink}`;
    const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waLink, "_blank", "noopener,noreferrer");
  }

  async function copyRoomCode() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        throw new Error("Clipboard unsupported");
      }
      setNotice("Room code copied.");
    } catch {
      setNotice("Unable to copy code. Please copy it manually.");
    }
  }

  async function joinWithCode() {
    const normalized = joinCode.trim().toUpperCase();
    if (!normalized) {
      setNotice("Enter a room code.");
      return;
    }

    const matchedRoom = rooms.find((roomItem) => toRoomCode(roomItem) === normalized);
    if (!matchedRoom) {
      setNotice("Room code not found.");
      return;
    }

    setRoom(matchedRoom);
    setJoinCode("");

    try {
      const messageData = await chatApi.roomMessages(matchedRoom._id);
      if (messageData?.messages) {
        setMessages(messageData.messages);
      }
      setNotice("Joined room via code.");
    } catch {
      setNotice("Joined room, but failed to load latest messages.");
    }
  }

  async function toggleMedia(kind) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice(`Please allow ${kind} permission to use this feature.`);
      return;
    }

    const isMic = kind === "microphone";
    const enabled = isMic ? micEnabled : cameraEnabled;
    const streamRef = isMic ? micStreamRef : cameraStreamRef;

    if (enabled && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (isMic) {
        setMicEnabled(false);
      } else {
        setCameraEnabled(false);
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: isMic,
        video: !isMic
      });
      streamRef.current = stream;
      if (isMic) {
        setMicEnabled(true);
      } else {
        setCameraEnabled(true);
      }
    } catch (error) {
      const isPermissionError = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      setNotice(isPermissionError ? `Please allow ${kind} permission to use this feature.` : `Unable to access ${kind} right now.`);
      if (isMic) {
        setMicEnabled(false);
      } else {
        setCameraEnabled(false);
      }
    }
  }

  return (
    <div className="study-hub-layout">
      <section className="hub-chat-panel">
        <div className="hub-header">
          <div className="panel-title">
            <Users size={18} />
            <div>
              <h2>{room.name}</h2>
              <p>{room.onlineCount || 3} online</p>
            </div>
          </div>
          <div className="hub-actions">
            <button className={`icon-action ${micEnabled ? "active" : ""}`} onClick={() => toggleMedia("microphone")} type="button">
              <Mic size={16} />
            </button>
            <button className={`icon-action ${cameraEnabled ? "active" : ""}`} onClick={() => toggleMedia("camera")} type="button">
              <Video size={16} />
            </button>
          </div>
        </div>

        <div className="message-list">
          {messages.map((message) => (
            <div className="message-row" key={message._id}>
              <div className={`avatar ${message.user?.role === "ai" || message.user?.name === "AI Assistant" ? "ai-avatar" : ""}`}>
                {message.user?.role === "ai" || message.user?.name === "AI Assistant" ? <Sparkles size={15} /> : message.user?.name?.charAt(0)}
              </div>
              <div className="message-content">
                <div className="message-meta">
                  <strong>{message.user?.name}</strong>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="chat-input-row">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} type="text" placeholder="Type a message..." />
          <button className="send-button" type="button" onClick={sendMessage}>
            <Send size={18} />
          </button>
        </div>
      </section>

      <aside className="hub-sidebar">
        <h3>Online Members</h3>
        <div className="member-list">
          {members.map((member) => (
            <div className="member-row" key={member.name}>
              <div className="member-left">
                <div className="member-badge">{member.name.charAt(0)}</div>
                <span>{member.name}</span>
              </div>
              <span className={`status-dot ${member.status}`} />
            </div>
          ))}
        </div>

        <div className="invite-panel">
          <h4>Invite by email</h4>
          <div className="invite-row">
            <input
              type="email"
              placeholder="Invite by email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
            <button className="primary-button compact" type="button" onClick={inviteByEmail}>
              Invite
            </button>
          </div>
          <div className="invite-options">
            <button className="secondary-button compact" type="button" onClick={openWhatsAppInvite}>
              <Link2 size={16} />
              Invite via WhatsApp
            </button>
          </div>
          <div className="invite-code-row">
            <span>Invite via Unique Code</span>
            <strong>{roomCode}</strong>
            <button className="secondary-button compact" type="button" onClick={copyRoomCode}>
              <Copy size={16} />
              Copy Code
            </button>
          </div>
          <div className="invite-row">
            <input
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
            <button className="primary-button compact" type="button" onClick={joinWithCode}>
              Join
            </button>
          </div>
        </div>

        {notice ? <div className="hub-toast">{notice}</div> : null}

        <div className="assistant-tip">
          <div className="panel-title">
            <Bot size={18} />
            <h4>AI Assistant</h4>
          </div>
          <p>Ask questions with "?" to get AI help directly in the room.</p>
        </div>
      </aside>
    </div>
  );
}

export default StudyHubPage;
