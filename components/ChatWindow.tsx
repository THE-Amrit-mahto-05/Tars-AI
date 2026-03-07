"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Send, Loader2, Sparkles, Trash2, ArrowDown, SmilePlus, Square, Copy, Check, MessageSquare, AtSign, X, Edit2, CheckCircle2, Users, ImagePlus, MoreVertical, LogOut } from "lucide-react";
import { format, isToday, isYesterday, isThisYear } from "date-fns";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";

const PRESET_ICONS = [
  "https://api.dicebear.com/7.x/shapes/svg?seed=1",
  "https://api.dicebear.com/7.x/shapes/svg?seed=2",
  "https://api.dicebear.com/7.x/shapes/svg?seed=3",
  "https://api.dicebear.com/7.x/shapes/svg?seed=4",
  "https://api.dicebear.com/7.x/shapes/svg?seed=5",
  "https://api.dicebear.com/7.x/shapes/svg?seed=6",
];

export function ChatWindow({ conversationId }: { conversationId: Id<"conversations"> }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [streamingAIText, setStreamingAIText] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const me = useQuery(api.users.getMe);
  const details = useQuery(api.conversations.getChatDetails, { conversationId });
  const { theme } = useTheme();
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const sendAI = useMutation(api.messages.sendAIResponse);
  const removeMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const setTyping = useMutation(api.conversations.setTyping);
  const markAsRead = useMutation(api.presence.markAsRead);
  const startPrivateChat = useMutation(api.conversations.getOrCreateConversation);
  const updateGroup = useMutation(api.conversations.updateGroupDetails);
  const leaveGroup = useMutation(api.conversations.leaveGroup);
  const deleteConversation = useMutation(api.conversations.deleteConversation);

  const members = useQuery(api.conversations.getGroupMembers, { conversationId });
  const aiMember = members?.find(m => m?.isAI);

  const isChattingWithAI = details?.otherUser?.clerkId === "ai-bot";

  useEffect(() => {
    if (messages) {
      markAsRead({ conversationId });
    }
  }, [messages, conversationId, markAsRead]);

  useEffect(() => {
    setShowGroupInfo(false);
  }, [conversationId]);

  useEffect(() => {
    if (!input.trim()) {
      setTyping({ conversationId, isTyping: false });
      return;
    }

    setTyping({ conversationId, isTyping: true });

    const timeout = setTimeout(() => {
      setTyping({ conversationId, isTyping: false });
    }, 2000);

    return () => clearTimeout(timeout);
  }, [input, conversationId, setTyping]);

  const lastScrolledId = useRef<string | null>(null);

  useEffect(() => {
    if (messages && messages.length > 0 && conversationId !== lastScrolledId.current) {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "instant",
        });
        lastScrolledId.current = conversationId;
        setShowScrollButton(false);
      }
    }
  }, [messages, conversationId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || showScrollButton) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;

    if (isAtBottom) {
      container.scrollTo({
        top: scrollHeight,
        behavior: (isAiGenerating || streamingAIText) ? "instant" : "smooth",
      });
    }
  }, [messages, isAiGenerating, streamingAIText, showScrollButton]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollButton(isUp);
  };

  useEffect(() => {
    inputRef.current?.focus();
    setShowScrollButton(false);
  }, [conversationId]);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");

    await sendMessage({ body: userMessage, conversationId });
    setTimeout(() => inputRef.current?.focus(), 0);

    const shouldTriggerAI = isChattingWithAI || (details?.conversation.isGroup && userMessage.includes("@Tars"));

    if (shouldTriggerAI) {
      try {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setIsAiGenerating(true);
        setStreamingAIText("");

        if (isChattingWithAI && details.otherUser) {
          setTyping({ conversationId, isTyping: true, userId: details.otherUser._id });
        } else if (aiMember) {
          setTyping({ conversationId, isTyping: true, userId: aiMember._id });
        }

        const contextMessages = messages?.slice(-3).map(m => ({
          role: m.authorId === me?._id ? "user" : "assistant",
          content: m.body
        })) || [];

        const response = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: [...contextMessages, { role: "user", content: userMessage }]
          }),
          signal,
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let aiText = "";
        let displayedAiText = "";

        const displayLoop = setInterval(() => {
          if (displayedAiText.length < aiText.length) {
            const chunkSize = Math.min(10, aiText.length - displayedAiText.length);
            displayedAiText += aiText.substring(displayedAiText.length, displayedAiText.length + chunkSize);
            setStreamingAIText(displayedAiText);
          }
        }, 5);

        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            const chunk = decoder.decode(value);
            aiText += chunk;
          }

          while (displayedAiText.length < aiText.length) {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        } finally {
          clearInterval(displayLoop);
        }

        if (aiText) {
          await sendAI({ body: aiText, conversationId });
        }

        await setTyping({ conversationId, isTyping: false });
        setIsAiGenerating(false);
        setStreamingAIText("");
        abortControllerRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 0);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("AI Error:", error);
        }
        await setTyping({ conversationId, isTyping: false });
        setIsAiGenerating(false);
        setStreamingAIText("");
        abortControllerRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  const handleStopAI = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteChat = async () => {
    try {
      setIsDeleting(true);
      setShowConfirmClear(false);
      await deleteConversation({ conversationId });
    } catch (err) {
      console.error(err);
      alert("Failed to clear chat");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      setIsDeleting(true);
      await leaveGroup({ conversationId });
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Failed to leave group");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatMessageTimestamp = (ts: number) => format(new Date(ts), "h:mm a");

  const formatDateLabel = (ts: number) => {
    const date = new Date(ts);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    if (isThisYear(date)) return format(date, "MMMM d");
    return format(date, "MMMM d, yyyy");
  };

  const formatLastSeen = (ts: number | undefined) => {
    if (!ts) return "offline";
    const date = new Date(ts);
    const timeStr = format(date, "h:mm a");
    if (isToday(date)) return `last seen today at ${timeStr}`;
    if (isYesterday(date)) return `last seen yesterday at ${timeStr}`;
    if (isThisYear(date)) return `last seen on ${format(date, "MMM d")} at ${timeStr}`;
    return `last seen on ${format(date, "MMM d, yyyy")} at ${timeStr}`;
  };

  const isSameDay = (ts1: number, ts2: number) =>
    format(new Date(ts1), "yyyy-MM-dd") === format(new Date(ts2), "yyyy-MM-dd");

  if (details === undefined || messages === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center themed-bg themed-text">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (details === null) {
    router.push("/");
    return (
      <div className="flex-1 flex items-center justify-center themed-bg themed-text">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const otherUser = details.otherUser;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-200 themed-chat-bg relative">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] z-0" />

      {/* Header */}
      <div className="h-[60px] px-6 flex items-center justify-between border-b shadow-sm transition-colors duration-200 themed-bg themed-border z-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative cursor-pointer hover:opacity-90 transition-opacity" onClick={() => details?.conversation.isGroup && setShowGroupInfo(true)}>
            <img
              src={details?.conversation.isGroup
                ? (details?.conversation.icon || "https://cdn-icons-png.flaticon.com/512/166/166258.png")
                : details?.otherUser?.image}
              className="h-10 w-10 rounded-full object-cover border border-black/5"
              alt="Avatar"
            />
            {!details?.conversation.isGroup && details?.otherUser?.isOnline && (
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 themed-border" style={{ backgroundColor: 'var(--accent)' }} />
            )}
          </div>
          <div className="flex flex-col text-left overflow-hidden">
            <h3 className="text-[15px] font-bold truncate leading-tight transition-colors themed-text">
              {details?.conversation.isGroup ? details?.conversation.name : details?.otherUser?.name}
            </h3>
            <p className="text-[12px] font-medium transition-colors themed-text-secondary">
              {details?.conversation.isGroup
                ? `${details?.groupDetails?.participantCount} members`
                : details?.otherUser?.isOnline ? "online" : (details?.otherUser?.lastSeen ? formatLastSeen(details.otherUser.lastSeen) : "offline")}
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 relative"
          onMouseEnter={() => setShowDeleteMenu(true)}
          onMouseLeave={() => setShowDeleteMenu(false)}
        >
          <button
            className="p-2 hover:bg-black/5 rounded-full transition-colors themed-text-secondary"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {showDeleteMenu && (
            <div className="absolute top-full right-0 mt-1 border shadow-xl rounded-xl py-1.5 w-48 z-[100] animate-in fade-in zoom-in duration-200 themed-bg themed-border">
              <button
                onClick={() => {
                  setShowDeleteMenu(false);
                  setShowConfirmClear(true);
                }}
                disabled={isDeleting}
                className="w-full px-4 py-2 text-left text-[14px] text-[#ef4444] hover:bg-[#ef4444]/10 flex items-center gap-3 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Clearing..." : "Clear Chat"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto z-10 custom-scrollbar pb-4 relative"
      >
        <div className="max-w-[1000px] mx-auto p-4 md:p-8 space-y-2">
          {messages?.length === 0 && !isAiGenerating && (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <div className="p-6 rounded-full shadow-sm mb-4 themed-bg">
                <Sparkles className="h-12 w-12" style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-lg font-medium themed-text">No messages yet</p>
              <p className="text-sm themed-text-secondary">Send a message to start the conversation!</p>
            </div>
          )}
          {messages?.map((msg: any, index: number) => {
            const prevMsg = messages[index - 1];
            const isSameAuthorAsPrev = prevMsg?.authorId === msg.authorId;
            const isSystem = msg.isSystem;
            const isMe = msg.authorId === me?._id;
            const isDeleted = msg.isDeleted;

            if (isSystem) {
              const showDateDivider = !prevMsg || !isSameDay(prevMsg._creationTime, msg._creationTime);
              return (
                <React.Fragment key={msg._id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-black/5 text-[11px] font-semibold px-4 py-1 rounded-full tracking-wide themed-text-secondary backdrop-blur-sm">
                        {formatDateLabel(msg._creationTime)}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-center my-1 w-full">
                    <div className="bg-black/5 backdrop-blur-sm text-[12px] px-4 py-1 rounded-full font-medium themed-text-secondary">
                      {msg.body}
                    </div>
                  </div>
                </React.Fragment>
              );
            }

            const showDateDivider = !prevMsg || !isSameDay(prevMsg._creationTime, msg._creationTime);

            return (
              <React.Fragment key={msg._id}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-black/5 text-[11px] font-semibold px-4 py-1 rounded-full tracking-wide themed-text-secondary backdrop-blur-sm">
                      {formatDateLabel(msg._creationTime)}
                    </div>
                  </div>
                )}
                <div
                  className={`flex group w-full ${isMe ? "justify-end" : "justify-start"} ${!isSameAuthorAsPrev || showDateDivider ? "mt-4" : "mt-0.5"}`}
                >
                  {!isMe && (
                    <div className="w-8 shrink-0 mr-2 flex justify-end items-end transition-opacity" />
                  )}

                  <div className={`relative max-w-[85%] sm:max-w-[70%] px-4 py-2.5 shadow-sm group transition-all duration-200
                    ${isMe
                      ? "rounded-2xl rounded-tr-sm"
                      : "rounded-2xl rounded-tl-sm border themed-border"
                    }
                    ${isDeleted ? "opacity-50 grayscale-[0.5]" : ""}
                  `}
                    style={{
                      backgroundColor: isMe ? 'var(--bubble-me)' : 'var(--bubble-other)',
                      color: isMe ? 'var(--bubble-me-text)' : 'var(--bubble-other-text)',
                    }}
                  >
                    {details?.conversation.isGroup && !isMe && (
                      <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--accent)' }}>{msg.authorName}</p>
                    )}
                    <div className={`text-[15px] leading-relaxed break-words pr-10 markdown-content ${isDeleted ? "italic opacity-70" : ""}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {isDeleted ? "This message was deleted" : msg.body}
                      </ReactMarkdown>
                    </div>

                    {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(
                          msg.reactions.reduce((acc: any, r: any) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]: [string, any]) => {
                          const hasReacted = msg.reactions?.some((r: any) => r.isMe && r.emoji === emoji);
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction({ messageId: msg._id, emoji })}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold transition-all border
                            ${hasReacted
                                  ? "bg-black/10 border-black/20 themed-text"
                                  : "bg-black/5 border-transparent themed-text-secondary hover:border-black/10"
                                }`}
                            >
                              <span>{emoji}</span>
                              <span>{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!isDeleted && (
                      <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all
                        ${isMe ? "-left-20" : "-right-16 md:-right-20"}
                      `}>
                        <div className="relative group/picker">
                          <button
                            className="h-8 w-8 flex items-center justify-center rounded-full border shadow-sm themed-bg themed-border themed-text-secondary hover:themed-text"
                            title="Add reaction"
                          >
                            <SmilePlus className="h-4 w-4" />
                          </button>

                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 border shadow-xl rounded-full px-2 py-1.5 flex gap-1.5 scale-0 group-hover/picker:scale-100 transition-transform origin-bottom z-[100] themed-bg themed-border">
                            {["👍", "❤️", "😂", "😮", "😢", "🔥"].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction({ messageId: msg._id, emoji })}
                                className="hover:scale-125 transition-transform p-0.5 text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCopy(msg._id, msg.body)}
                          className="h-8 w-8 flex items-center justify-center rounded-full border shadow-sm transition-all themed-bg themed-border themed-text-secondary hover:themed-text"
                          title="Copy message"
                        >
                          {copiedId === msg._id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>

                        {isMe && (
                          <button
                            onClick={() => removeMessage({ messageId: msg._id })}
                            className="h-8 w-8 flex items-center justify-center rounded-full border shadow-sm themed-bg themed-border text-[#ef4444] hover:bg-[#ef4444]/10"
                            title="Delete message"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}

                    <span className={`absolute bottom-1 right-2 text-[10px] select-none font-medium opacity-60`}
                    >
                      {formatMessageTimestamp(msg._creationTime)}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}


          {isAiGenerating && (
            <div className="flex w-full justify-start mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 items-end max-w-[85%] sm:max-w-[70%]">
                <div className="relative shrink-0">
                  <img src={otherUser?.image ?? "https://cdn-icons-png.flaticon.com/512/166/166258.png"} className="h-8 w-8 rounded-full border themed-border" alt="AI Agent" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border themed-border px-4 py-3 shadow-sm themed-bg">
                  {streamingAIText ? (
                    <div className="text-[15px] leading-relaxed break-words markdown-content themed-text">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingAIText}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: 'var(--accent)' }} />
                        <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: 'var(--accent)' }} />
                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent)' }} />
                      </div>
                      <span className="text-[13px] font-medium ml-2 themed-text-secondary">Tars is thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {showScrollButton && (
        <button
          onClick={() => {
            setShowScrollButton(false);
            scrollRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
          className="absolute bottom-28 right-6 md:right-10 z-[100] flex items-center gap-2 text-white px-4 py-2 rounded-full shadow-2xl animate-in zoom-in slide-in-from-bottom-5 duration-300 font-medium text-sm group"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <ArrowDown className="h-4 w-4 animate-bounce" />
          <span>New messages</span>
        </button>
      )}

      <div className="px-4 pb-6 z-20">
        <div className="max-w-[1000px] mx-auto flex items-end gap-3">
          <form onSubmit={handleSend} className="flex-1 relative flex items-end gap-2">
            <div className="flex-1 relative border rounded-[24px] px-5 py-3 shadow-xl min-h-[50px] transition-colors themed-bg themed-border focus-within:border-black/10">
              <textarea
                rows={1}
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                disabled={isAiGenerating}
                placeholder={isAiGenerating ? "Tars is thinking..." : "Message"}
                className="w-full bg-transparent border-none placeholder-gray-400 focus:outline-none text-[15px] resize-none max-h-48 custom-scrollbar pt-0.5 themed-text"
              />
            </div>
            {isAiGenerating ? (
              <button
                type="button"
                onClick={handleStopAI}
                className="h-[50px] w-[50px] flex items-center justify-center rounded-full transition-all shadow-xl border shrink-0 active:scale-90 themed-bg themed-border text-[#ef4444] hover:bg-[#ef4444]/10"
                title="Stop generation"
              >
                <Square className="h-5 w-5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-[50px] w-[50px] flex items-center justify-center rounded-full text-white hover:opacity-90 disabled:opacity-0 disabled:scale-95 transition-all shadow-xl shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Send className="h-6 w-6 ml-[-2px]" />
              </button>
            )}
          </form>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2);
        }

        .markdown-content p {
          margin-bottom: 0.75rem;
        }
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        .markdown-content h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 1rem 0 0.5rem 0;
          color: var(--accent);
        }
        .markdown-content ul, .markdown-content ol {
          margin-bottom: 0.75rem;
          padding-left: 1.25rem;
        }
        .markdown-content li {
          margin-bottom: 0.25rem;
        }
        .markdown-content strong {
          color: inherit;
          font-weight: 700;
        }
      `}</style>

      {showGroupInfo && (
        <GroupInfo
          conversationId={conversationId}
          details={details}
          onClose={() => setShowGroupInfo(false)}
          onMention={(name) => {
            setInput(prev => prev + `@${name} `);
            setShowGroupInfo(false);
            inputRef.current?.focus();
          }}
          onMessage={async (userId) => {
            const privateChatId = await startPrivateChat({ otherUserId: userId });
            router.push(`/?chat=${privateChatId}`);
            setShowGroupInfo(false);
          }}
          onUpdate={async (updates) => {
            await updateGroup({ conversationId, ...updates });
          }}
          onLeave={handleLeaveGroup}
        />
      )}

      {showConfirmClear && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 themed-bg">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ef4444] to-[#f97316] flex items-center justify-center mb-4 shadow-lg">
                <Trash2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold themed-text mb-1">Clear Conversation?</h3>
              <p className="themed-text-secondary text-sm leading-relaxed">
                All messages will be permanently deleted. The conversation and its members will remain.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 py-3 rounded-2xl font-semibold bg-black/5 hover:bg-black/10 transition-colors themed-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-2xl font-bold bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? "Clearing..." : "Clear Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupInfo({
  conversationId,
  details,
  onClose,
  onMention,
  onMessage,
  onUpdate,
  onLeave,
}: {
  conversationId: Id<"conversations">;
  details: any;
  onClose: () => void;
  onMention: (name: string) => void;
  onMessage: (userId: Id<"users">) => void;
  onUpdate: (updates: { name?: string; description?: string; icon?: string; storageId?: Id<"_storage"> }) => Promise<void>;
  onLeave: () => Promise<void>;
}) {
  const members = useQuery(api.conversations.getGroupMembers, { conversationId });
  const groupDetails = details.groupDetails;
  const me = useQuery(api.users.getMe);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(groupDetails?.name || "");
  const [editDesc, setEditDesc] = useState(groupDetails?.description || "");
  const [editIcon, setEditIcon] = useState(groupDetails?.icon || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStorageId, setCurrentStorageId] = useState<Id<"_storage"> | null>(null);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  useEffect(() => {
    if (groupDetails && !isEditing) {
      setEditName(groupDetails.name || "");
      setEditDesc(groupDetails.description || "");
      setEditIcon(groupDetails.icon || "");
    }
  }, [groupDetails, isEditing]);

  const isAdmin = me?._id === details.conversation.adminId;

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      await onUpdate({
        name: editName,
        description: editDesc,
        icon: editIcon,
        storageId: currentStorageId || undefined,
      });
      setCurrentStorageId(null);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMentionAll = () => {
    const allMentions = members
      ?.filter(m => m?._id !== me?._id)
      ?.map(m => `@${m?.name}`)
      ?.join(" ");
    if (allMentions) {
      onMention(allMentions);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 bg-black/20 z-[100] animate-in fade-in duration-300 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 themed-bg"
      >
        <div className="h-16 border-b px-6 flex items-center justify-between shrink-0 themed-border">
          <h3 className="text-lg font-bold text-center flex-1 themed-text">Group Info</h3>
          <div className="flex items-center gap-1">
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                style={{ color: 'var(--accent)' }}
                title="Edit Group"
              >
                <Edit2 className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 rounded-full transition-colors themed-text-secondary"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8 flex flex-col items-center border-b themed-border bg-black/[0.02]">
            {isEditing ? (
              <div className="w-full space-y-4">
                <div className="flex flex-col items-center mb-6 w-full">
                  <div className="flex items-center gap-4 justify-center flex-wrap max-w-sm mb-4">
                    {PRESET_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => {
                          setEditIcon(icon);
                          setCurrentStorageId(null);
                        }}
                        className={`h-12 w-12 rounded-full border-2 transition-all overflow-hidden ${editIcon === icon ? 'scale-110 shadow-lg' : 'border-transparent hover:border-black/20 hover:scale-105'}`}
                        style={{ borderColor: editIcon === icon ? 'var(--accent)' : 'transparent' }}
                      >
                        <img src={icon} className="h-full w-full object-cover" alt="Preset Icon" />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wider themed-text-secondary">Select Group Icon</p>
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Group Name"
                  className="w-full p-2 border rounded-lg font-bold text-center text-lg focus:ring-1 themed-bg themed-text themed-border"
                  style={{ '--tw-ring-color': 'var(--accent)' } as any}
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description..."
                  rows={3}
                  className="w-full p-2 border rounded-lg text-sm focus:ring-1 resize-none themed-bg themed-text themed-border"
                  style={{ '--tw-ring-color': 'var(--accent)' } as any}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 text-sm font-medium themed-text-secondary bg-black/5 hover:bg-black/10 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isUpdating || !editName.trim()}
                    className="flex-1 py-2 text-sm font-medium text-white hover:opacity-90 rounded-lg transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <img
                  src={groupDetails?.icon ?? "https://cdn-icons-png.flaticon.com/512/166/166258.png"}
                  className="h-32 w-32 rounded-full object-cover border-4 themed-border shadow-lg mb-4"
                  alt="Group Icon"
                />
                <h2 className="text-2xl font-bold themed-text mb-1">{groupDetails?.name}</h2>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[13px] uppercase tracking-wider font-bold themed-text-secondary">
                    Group · {groupDetails?.participantCount} Members
                  </p>
                </div>
                <button
                  onClick={handleMentionAll}
                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                >
                  <Users className="h-3 w-3" />
                  Mention Everyone
                </button>
              </>
            )}
          </div>

          {groupDetails?.description && (
            <div className="p-6 border-b themed-border">
              <h4 className="text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Description</h4>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap themed-text">{groupDetails.description}</p>
            </div>
          )}

          <div className="p-6 border-b themed-border">
            <div className="flex items-center gap-3 text-[13px] themed-text-secondary">
              <span>Created on {format(new Date(details.conversation._creationTime), "MMM d, yyyy")}</span>
            </div>
          </div>

          <div className="p-6">
            <h4 className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--accent)' }}>
              {groupDetails?.participantCount} Participants
            </h4>
            <div className="space-y-4">
              {members?.map((member: any) => (
                <div key={member._id} className="flex items-center gap-3 group">
                  <div className="relative">
                    <img src={member.image} className="h-10 w-10 rounded-full object-cover" alt={member.name} />
                    {member.isOnline && (
                      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 themed-border" style={{ backgroundColor: 'var(--accent)' }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 flex-1">
                      <p className="text-[15px] font-medium truncate max-w-[150px] themed-text">{member.name}</p>
                      {member.isAI && <Sparkles className="h-3 w-3" style={{ color: 'var(--accent)', fill: 'var(--accent)', opacity: 0.1 }} />}
                      {member._id === details.conversation.adminId && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>Admin</span>
                      )}
                    </div>
                    <p className="text-[12px] themed-text-secondary">
                      {member.isAI ? "Tars AI Agent" : member.isOnline ? "Online" : "Last seen recently"}
                    </p>
                  </div>

                  {me?._id !== member._id && !member.isAI && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onMention(member.name)}
                        className="p-2 hover:bg-black/5 rounded-full transition-colors"
                        style={{ color: 'var(--accent)' }}
                        title={`Mention ${member.name}`}
                      >
                        <AtSign className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onMessage(member._id)}
                        className="p-2 hover:bg-black/5 rounded-full transition-colors"
                        style={{ color: 'var(--accent)' }}
                        title={`Message ${member.name}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-black/[0.02] mt-auto">
            <button
              onClick={() => setShowConfirmLeave(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm themed-bg themed-border text-[#ef4444] hover:bg-[#ef4444]/10"
            >
              <LogOut className="h-4 w-4" />
              Leave Group
            </button>
          </div>
        </div>

        {showConfirmLeave && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 themed-bg">
              <h3 className="text-lg font-bold themed-text mb-2">Leave Group?</h3>
              <p className="themed-text-secondary text-sm mb-6">
                Are you sure you want to leave this group? You won't be able to send or receive messages here anymore.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmLeave(false)}
                  className="flex-1 py-2.5 rounded-xl font-medium themed-text-secondary bg-black/5 hover:bg-black/10 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={onLeave}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
