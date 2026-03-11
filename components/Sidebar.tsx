"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Search, Sparkles, Users, X, CheckCircle2, MessageSquare, AtSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { format, isToday, isThisYear } from "date-fns";
import { Settings, Moon, Sun, Palette } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import Image from "next/image";
import { Doc } from "@/convex/_generated/dataModel";
import { Conversation, PRESET_ICONS } from "./types";



const cleanMarkdown = (text: string) => {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")      // **bold**
    .replace(/\*(.*?)\*/g, "$1")          // *italic*
    .replace(/__(.*?)__/g, "$1")          // __bold__
    .replace(/_(.*?)_/g, "$1")            // _italic_
    .replace(/`{1,3}[^`]*`{1,3}/g, "")   // `code` or ```block```
    .replace(/^#{1,6}\s+/gm, "")         // # headers
    .replace(/^[-*+]\s+/gm, "")          // - list items
    .replace(/^\d+\.\s+/gm, "")          // 1. numbered lists
    .replace(/\n+/g, " ")                // collapse newlines
    .trim();
};

export function Sidebar() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const conversations = useQuery(api.conversations.list);
  const users = useQuery(api.users.list, { search: search });
  const startChat = useMutation(api.conversations.getOrCreateConversation);
  const createGroup = useMutation(api.conversations.createGroup);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupIcon, setGroupIcon] = useState<string>(PRESET_ICONS[0]);
  const [storageId, setStorageId] = useState<Id<"_storage"> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleUserClick = async (user: Doc<"users">) => {
    if (isSelectionMode) {
      if (selectedUsers.includes(user._id)) {
        setSelectedUsers(prev => prev.filter(id => id !== user._id));
      } else {
        setSelectedUsers(prev => [...prev, user._id]);
      }
      return;
    }
    const conversationId = await startChat({ otherUserId: user._id });
    router.push(`/?chat=${conversationId}`);
    setSearch("");
  };

  const handleChatClick = (conversationId: Id<"conversations">) => {
    router.push(`/?chat=${conversationId}`);
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length === 0 || !groupName.trim()) return;
    const finalName = groupName.trim();
    const conversationId = await createGroup({
      userIds: selectedUsers as Id<"users">[],
      name: finalName,
      description: groupDescription.trim() || undefined,
      icon: storageId ? undefined : (groupIcon || undefined),
      storageId: storageId || undefined

    });
    setGroupName("");
    setGroupDescription("");
    setStorageId(null);
    setGroupIcon(PRESET_ICONS[0]);
    setSelectedUsers([]);
    setIsSelectionMode(false);
    setSearch("");
    router.push(`/?chat=${conversationId}`);
  };


  return (
    <div className="w-full h-full flex flex-col border-r transition-colors duration-200 themed-bg themed-border">
      <div className="p-4 flex flex-col gap-4 border-b transition-colors duration-200 themed-border">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight transition-colors themed-text">Tars Chat</h1>
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedUsers([]);
              setGroupName("");
              setGroupDescription("");
              setSearch("");
            }}
            className={`p-2 rounded-full transition-colors ${isSelectionMode ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-black/5 hover:bg-black/10 transition-colors'}`}
            style={{ color: isSelectionMode ? 'white' : 'var(--accent)' }}
          >
            {isSelectionMode ? <X className="h-5 w-5" /> : <Users className="h-5 w-5" />}
          </button>
        </div>

        {isSelectionMode && (
          <div className="animate-in slide-in-from-top-2 duration-200 flex flex-col gap-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 border themed-border overflow-hidden">
                <Image src={groupIcon} width={40} height={40} unoptimized className="h-full w-full object-cover rounded-full" alt="Group Icon" />
              </div>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group Name (required)..."
                className="flex-1 border-none rounded-lg py-2 px-4 text-sm outline-none transition-all font-medium"
                style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-primary)' }}
              />
            </div>
            <textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Group Description (optional)..."
              rows={2}
              className="w-full border-none rounded-lg py-2 px-4 text-sm outline-none transition-all resize-none"
              style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-primary)' }}
            />
          </div>
        )}

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 themed-text-secondary group-focus-within:text-[var(--accent)] transition-colors" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isSelectionMode ? "Search people to add..." : "Enter an email to find someone..."}
            className="w-full border-none rounded-lg py-1.5 pl-10 pr-4 text-sm outline-none transition-all"
            style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-sidebar-scrollbar">
        {isSelectionMode ? (
          <div className="py-1">
            {users?.map((user) => (
              <SidebarUserItem
                key={user._id}
                user={user}
                isSelected={selectedUsers.includes(user._id)}
                isSelectionMode={true}
                onClick={() => handleUserClick(user)}
              />
            ))}
          </div>
        ) : search.trim() !== "" ? (
          <div className="py-1">
            {conversations && conversations.some(c =>
              (c.isGroup && c.name?.toLowerCase().includes(search.toLowerCase())) ||
              (!c.isGroup && c.otherUser?.name.toLowerCase().includes(search.toLowerCase()))
            ) && (
                <>
                  <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Chats</p>
                  {conversations && conversations.filter(c =>
                    (c.isGroup && c.name?.toLowerCase().includes(search.toLowerCase())) ||
                    (!c.isGroup && c.otherUser?.name.toLowerCase().includes(search.toLowerCase()))
                  ).map(conv => (
                    <SidebarChatItem key={conv._id} conversation={conv} onClick={() => handleChatClick(conv._id)} />
                  ))}
                </>
              )}

            <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider mt-2" style={{ color: 'var(--accent)' }}>People</p>
            {!search.trim() ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="p-3 rounded-full bg-black/5 mb-3">
                  <AtSign className="h-7 w-7 opacity-20" />
                </div>
                <p className="text-sm font-medium themed-text">Find someone</p>
                <p className="text-xs themed-text-secondary mt-1 max-w-[200px]">Enter a full email address to search for people.</p>
              </div>
            ) : users?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="p-3 rounded-full bg-black/5 mb-3">
                  <AtSign className="h-7 w-7 opacity-20" />
                </div>
                <p className="text-sm font-medium themed-text">No users found</p>
                <p className="text-xs themed-text-secondary mt-1">Make sure the email is typed correctly.</p>
              </div>
            ) : (
              users?.map((user) => (
                <SidebarUserItem
                  key={user._id}
                  user={user}
                  onClick={() => handleUserClick(user)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="py-1">
            {conversations === undefined ? (
              <div className="p-4 space-y-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-12 w-12 rounded-full bg-black/5" />
                    <div className="flex-1 space-y-2.5"><div className="h-3 w-28 bg-black/5 rounded-full" /></div>
                  </div>
                ))}
              </div>
            ) : (conversations && conversations.length > 0) ? (
              conversations.map((conv) => (
                <SidebarChatItem key={conv._id} conversation={conv} onClick={() => handleChatClick(conv._id)} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="p-5 rounded-2xl bg-black/5 mb-4">
                  <MessageSquare className="h-10 w-10 opacity-20" />
                </div>
                <p className="text-[15px] font-semibold themed-text mb-1">No conversations yet</p>
                <p className="text-[13px] themed-text-secondary leading-relaxed">
                  Search for someone below to start your first conversation!
                </p>
                <button
                  onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus()}
                  className="mt-5 px-5 py-2 rounded-full text-[13px] font-semibold text-white transition-all active:scale-95 shadow-md hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Start a Chat
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isSelectionMode && selectedUsers.length > 0 && (
        <div className="p-3 bg-[#f8fafc] border-t border-[#e2e8f0] animate-in slide-in-from-bottom-5">
          <p className="text-[11px] text-[#708499] text-center mb-2 font-medium">
            You + {selectedUsers.length} {selectedUsers.length === 1 ? 'participant' : 'participants'}
          </p>
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim()}
            className="w-full text-white py-2.5 rounded-xl font-semibold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Create Group
          </button>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200" onClick={() => setShowSettings(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 themed-bg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold themed-text">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <X className="h-5 w-5 themed-text-secondary" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--accent)' }}>Appearance</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'light', name: 'Light', icon: <Sun className="h-4 w-4" />, color: '#ffffff' },
                    { id: 'dark', name: 'Dark', icon: <Moon className="h-4 w-4" />, color: '#17212b' },
                    { id: 'whatsapp', name: 'WhatsApp', icon: <Palette className="h-4 w-4" />, color: '#25d366' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as "light" | "dark" | "whatsapp")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === t.id ? 'bg-black/5' : 'border-black/5 hover:border-black/10'}`}
                      style={{ borderColor: theme === t.id ? 'var(--accent)' : '' }}
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center mb-1" style={{ backgroundColor: t.color }}>
                        <span className={t.id === 'white' ? 'text-black' : 'text-white'}>{t.icon}</span>
                      </div>
                      <span className="text-xs font-medium themed-text">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <div className="p-3 border-t flex items-center justify-between transition-colors duration-200 themed-border" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="flex items-center gap-3">
          <UserButton />
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col text-left hover:opacity-80 transition-opacity"
          >
            <p className="text-[13px] font-medium flex items-center gap-1.5 transition-colors themed-text">
              Settings <Settings className="h-3 w-3 opacity-50" />
            </p>
            <p className="text-[11px] themed-text-secondary">Account & Privacy</p>
          </button>
        </div>
      </div>


      <style jsx global>{`
        .custom-sidebar-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function SidebarChatItem({ conversation, onClick }: { conversation: Conversation; onClick: () => void }) {
  const isGroup = conversation.isGroup;
  const imageUrl = isGroup
    ? (conversation.icon || "https://cdn-icons-png.flaticon.com/512/166/166258.png")
    : conversation.otherUser?.image;
  const name = isGroup ? conversation.name : conversation.otherUser?.name;

  const unreadCount = conversation.unreadCount;

  const formatMessageTimestamp = (ts: number) => {
    const date = new Date(ts);
    if (isToday(date)) return format(date, "h:mm a");
    if (isThisYear(date)) return format(date, "MMM d, h:mm a");
    return format(date, "MMM d, yyyy, h:mm a");
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors group relative border-b border-transparent sidebar-item-hover"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[4px] transition-opacity opacity-0 group-hover:opacity-100" style={{ backgroundColor: 'var(--accent)' }} />
      <div className="relative shrink-0">
        <div className="overflow-hidden rounded-full">
          <Image src={imageUrl ?? ""} width={48} height={48} unoptimized className="h-12 w-12 rounded-full object-cover" alt={name ?? "alt"} />
        </div>
        {!isGroup && !conversation.otherUser?.isAI && conversation.otherUser?.isOnline && (
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 themed-border z-10" style={{ backgroundColor: 'var(--accent)' }} />
        )}
      </div>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-baseline mb-0.5">
          <p className="text-[15px] font-medium truncate flex items-center gap-1.5 transition-colors themed-text">
            {name}
            {!isGroup && conversation.otherUser?.isAI && <Sparkles className="h-3 w-3" style={{ color: 'var(--accent)', fill: 'var(--accent)', opacity: 0.2 }} />}
          </p>
          {unreadCount ? (
            <span className="text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center" style={{ backgroundColor: 'var(--accent)' }}>
              {unreadCount}
            </span>
          ) : (
            <span className="text-[12px] transition-colors themed-text-secondary">
              {conversation.lastMessage ? formatMessageTimestamp(conversation.lastMessage._creationTime) : ""}
            </span>
          )}
        </div>
        {conversation.typingUserName ? (
          <p className="text-[13.5px] truncate transition-colors font-medium animate-pulse" style={{ color: 'var(--accent)' }}>
            {isGroup ? `${conversation.typingUserName} is typing...` : 'typing...'}
          </p>
        ) : (
          <p className="text-[13.5px] truncate transition-colors themed-text-secondary">
            {conversation.lastMessage
              ? (conversation.lastMessage.isSystem
                ? `📢 ${conversation.lastMessage.body}`
                : cleanMarkdown(conversation.lastMessage.body))
              : isGroup ? "Group created" : "Click to chat"}
          </p>
        )}
      </div>
    </button>
  );
}

function SidebarUserItem({
  user,
  onClick,
  isSelected,
  isSelectionMode
}: {
  user: Doc<"users">;
  onClick: () => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors group relative border-b border-transparent ${isSelected ? 'bg-black/5' : 'sidebar-item-hover'}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[4px] transition-opacity ${isSelected || isSelectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: 'var(--accent)' }} />

      <div className="relative shrink-0">
        <div className="overflow-hidden rounded-full">
          <Image src={user.image} width={48} height={48} unoptimized className="h-12 w-12 rounded-full object-cover" alt={user.name} />
        </div>
        {isSelectionMode && isSelected && (
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-white flex items-center justify-center border-2 themed-border animate-in zoom-in duration-200 z-10" style={{ backgroundColor: 'var(--accent)' }}>
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}
      </div>

      <div className="flex-1 text-left overflow-hidden">
        <p className="text-[15px] font-medium truncate flex items-center gap-1.5 themed-text">
          {user.name}
          {user.isAI && <Sparkles className="h-3 w-3" style={{ color: 'var(--accent)', fill: 'var(--accent)', opacity: 0.2 }} />}
        </p>
        <p className="text-[13.5px] truncate themed-text-secondary">
          {isSelectionMode ? (isSelected ? "Selected" : "Click to select") : "Click to chat"}
        </p>
      </div>
    </button>
  );
}
