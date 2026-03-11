import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getOrCreateConversation = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    const existing = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.or(
          q.and(q.eq(q.field("participantOne"), me._id), q.eq(q.field("participantTwo"), args.otherUserId)),
          q.and(q.eq(q.field("participantOne"), args.otherUserId), q.eq(q.field("participantTwo"), me._id))
        )
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      participantOne: me._id,
      participantTwo: args.otherUserId,
      isGroup: false,
    });
  },
});

export const createGroup = mutation({
  args: {
    userIds: v.array(v.id("users")),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");
    if (!args.name.trim()) throw new Error("Group name is required");

    let iconUrl = args.icon;
    if (args.storageId) {
      const url = await ctx.storage.getUrl(args.storageId);
      if (url) iconUrl = url;
    }

    const conversationId = await ctx.db.insert("conversations", {
      name: args.name,
      description: args.description,
      icon: iconUrl,
      isGroup: true,
      participants: [...args.userIds, me._id],
      adminId: me._id,
      storageId: args.storageId,
    });

    await ctx.db.insert("messages", {
      body: `${me.name} created the group "${args.name}"`,
      authorId: me._id,
      conversationId,
      isSystem: true,
    });

    return conversationId;
  },
});

export const getChatDetails = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;


    let groupIcon = conversation.icon;
    if (conversation.storageId) {
      const url = await ctx.storage.getUrl(conversation.storageId);
      if (url) groupIcon = url;
    }

    let otherUser = null;
    if (!conversation.isGroup) {
      const otherUserId =
        conversation.participantOne === me._id
          ? conversation.participantTwo
          : conversation.participantOne;

      if (otherUserId) {
        const u = await ctx.db.get(otherUserId);
        if (u) {
          otherUser = {
            ...u,
            isOnline: u.isOnline && (Date.now() - (u.lastSeen ?? 0) < 25000),
          };
        }
      }
    }

    let typingUserImage = null;
    let finalTypingUser = conversation.typingUser;

    if (conversation.typingUser) {
      const tUser = await ctx.db.get(conversation.typingUser);
      if (tUser && !tUser.isAI && tUser.clerkId !== "ai-bot" && tUser.name !== "Tars AI") {
        typingUserImage = tUser.image || null;
      } else {
        // Force clear if it's AI or missing
        finalTypingUser = undefined;
        typingUserImage = null;
      }
    }

    return {
      conversation: {
        ...conversation,
        typingUser: finalTypingUser,
        typingUserImage
      },
      otherUser,
      groupDetails: conversation.isGroup ? {
        name: conversation.name,
        description: conversation.description,
        icon: groupIcon,
        participantCount: conversation.participants?.length ?? 0,
        adminId: conversation.adminId,
      } : null
    };
  },
});

export const getGroupMembers = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.isGroup || !conversation.participants) return [];

    return await Promise.all(
      conversation.participants.map(async (id) => {
        return await ctx.db.get(id);
      })
    );
  },
});

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
    userId: v.optional(v.id("users"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    let typingUserId = args.userId;

    if (!typingUserId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
      if (!user) return;
      typingUserId = user._id;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    // PROACTIVE BLOCK: Don't allow AI to ever be marked as typing
    if (args.isTyping && typingUserId) {
      const tUser = await ctx.db.get(typingUserId);
      if (tUser?.isAI || tUser?.clerkId === "ai-bot" || tUser?.name === "Tars AI") {
        return;
      }
    }

    // Safety check: Only clear if the caller IS the currently stored typing user
    // Exception: Allow clearing if the currently stored user is the AI bot
    if (!args.isTyping && conversation.typingUser && conversation.typingUser !== typingUserId) {
      const currentTypingUser = await ctx.db.get(conversation.typingUser);
      // If we can't find the user, or it's an AI bot, allow the clear
      if (currentTypingUser && !currentTypingUser.isAI && currentTypingUser.clerkId !== "ai-bot" && currentTypingUser.name !== "Tars AI") {
        return;
      }
    }

    await ctx.db.patch(args.conversationId, {
      typingUser: args.isTyping ? typingUserId : undefined,
    });
  },
});

export const findConversation = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) return null;

    return await ctx.db
      .query("conversations")
      .filter((q) =>
        q.or(
          q.and(q.eq(q.field("participantOne"), me._id), q.eq(q.field("participantTwo"), args.otherUserId)),
          q.and(q.eq(q.field("participantOne"), args.otherUserId), q.eq(q.field("participantTwo"), me._id))
        )
      )
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) return [];

    const conversations = await ctx.db
      .query("conversations")
      .collect();

    const myConversations = conversations.filter(c =>
      c.participantOne === me._id ||
      c.participantTwo === me._id ||
      (c.isGroup && c.participants?.includes(me._id))
    );

    return await Promise.all(
      myConversations.map(async (conv) => {
        let otherUser = null;
        if (!conv.isGroup) {
          const otherUserId = conv.participantOne === me._id ? conv.participantTwo : conv.participantOne;
          if (otherUserId) otherUser = await ctx.db.get(otherUserId);
        }

        let groupIcon = conv.icon;
        if (conv.storageId) {
          const url = await ctx.storage.getUrl(conv.storageId);
          if (url) groupIcon = url;
        }

        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();

        // Optimized Unread Count
        const presence = await ctx.db
          .query("userPresence")
          .withIndex("by_user_conversation", (q) =>
            q.eq("userId", me._id).eq("conversationId", conv._id)
          )
          .unique();

        const lastReadTime = presence?.lastReadTime ?? 0;
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
          .filter((q) => q.neq(q.field("authorId"), me._id))
          .collect();

        const unreadCount = unreadMessages.length;

        let typingUserName = null;
        let finalTypingUser = conv.typingUser;
        if (conv.typingUser && conv.typingUser !== me._id) {
          const tUser = await ctx.db.get(conv.typingUser);
          if (tUser && !tUser.isAI && tUser.clerkId !== "ai-bot" && tUser.name !== "Tars AI") {
            typingUserName = tUser.name || null;
          } else {
            // Filter it out if it's AI or missing
            finalTypingUser = undefined;
            typingUserName = null;
          }
        }

        return {
          ...conv,
          typingUser: finalTypingUser,
          icon: groupIcon,
          otherUser: otherUser ? {
            ...otherUser,
            isOnline: otherUser.isOnline && (Date.now() - (otherUser.lastSeen ?? 0) < 25000),
          } : null,
          lastMessage: lastMessage ? {
            body: lastMessage.body,
            _creationTime: lastMessage._creationTime,
            isSystem: lastMessage.isSystem,
          } : null,
          typingUserName,
          unreadCount,
        };
      })
    );
  },
});

export const updateGroupDetails = mutation({
  args: {
    conversationId: v.id("conversations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");
    if (args.name !== undefined && !args.name.trim()) {
      throw new Error("Group name is required");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.isGroup) {
      throw new Error("Group not found");
    }

    if (conversation.adminId !== me._id) {
      throw new Error("Only the admin can update group details");
    }

    const updates: {
      name?: string;
      description?: string;
      icon?: string;
      storageId?: Id<"_storage">;
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    if (args.storageId) {
      const url = await ctx.storage.getUrl(args.storageId);
      if (url) updates.icon = url;
      updates.storageId = args.storageId;
    } else if (args.icon !== undefined) {
      updates.icon = args.icon;
    }

    await ctx.db.patch(args.conversationId, updates);

    // Add a system message about the update
    let messageBody = `${me.name} updated the group details`;
    if (args.name) messageBody = `${me.name} changed the group name to "${args.name}"`;
    else if (args.icon) messageBody = `${me.name} updated the group icon`;

    await ctx.db.insert("messages", {
      body: messageBody,
      authorId: me._id,
      conversationId: args.conversationId,
      isSystem: true,
    });
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const leaveGroup = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.isGroup || !conversation.participants) {
      throw new Error("Group not found");
    }

    const newParticipants = conversation.participants.filter(id => id !== me._id);

    if (newParticipants.length === 0) {
      // Last person left, delete conversation and messages
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .collect();
      for (const msg of msgs) await ctx.db.delete(msg._id);
      await ctx.db.delete(args.conversationId);
      return;
    }

    const updates: {
      participants: Id<"users">[];
      adminId?: Id<"users">;
    } = { participants: newParticipants };

    // If I was admin, pick a new one
    if (conversation.adminId === me._id) {
      updates.adminId = newParticipants[0];
    }

    await ctx.db.patch(args.conversationId, updates);

    await ctx.db.insert("messages", {
      body: `${me.name} left the group`,
      authorId: me._id,
      conversationId: args.conversationId,
      isSystem: true,
    });
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Only allow participants to clear
    const isParticipant =
      conversation.participantOne === me._id ||
      conversation.participantTwo === me._id ||
      (conversation.isGroup && conversation.participants?.includes(me._id));

    if (!isParticipant) throw new Error("Unauthorized to clear this chat");

    // Delete all messages only — group and participants stay intact
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    for (const msg of msgs) await ctx.db.delete(msg._id);
  },
});
