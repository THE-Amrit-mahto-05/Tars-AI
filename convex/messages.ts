import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // Batch fetch authors to avoid N+1
    const authorIds = [...new Set(messages.map(m => m.authorId))];
    const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)));
    const authorMap = new Map(authorIds.map((id, i) => [id, authors[i]]));

    return messages.map((msg) => {
      const author = authorMap.get(msg.authorId);
      return {
        ...msg,
        authorName: author?.name ?? "Unknown",
        authorImage: author?.image ?? "",
        isMe: author?.clerkId === identity.subject,
      };
    });
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) throw new Error("User not found");

    return await ctx.db.insert("messages", {
      body: args.body,
      authorId: me._id,
      conversationId: args.conversationId,
    });
  },
});

export const sendAIResponse = mutation({
  args: {
    body: v.string(),
    conversationId: v.id("conversations")
  },
  handler: async (ctx, args) => {
    const aiUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", "ai-bot"))
      .unique();

    if (!aiUser) return;

    await ctx.db.insert("messages", {
      body: args.body,
      authorId: aiUser._id,
      conversationId: args.conversationId,
    });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const message = await ctx.db.get(args.messageId);
    if (!message) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || message.authorId !== user._id) {
      throw new Error("You can only delete your own messages");
    }

    await ctx.db.patch(args.messageId, {
      body: "_This message was deleted_",
      isDeleted: true,
    });
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const message = await ctx.db.get(args.messageId);
    if (!message || !user) return;

    const reactions = message.reactions ?? [];
    const existingIndex = reactions.findIndex(
      (r) => r.user === user._id && r.emoji === args.emoji
    );

    if (existingIndex > -1) {
      reactions.splice(existingIndex, 1);
    } else {
      reactions.push({ user: user._id, emoji: args.emoji });
    }

    await ctx.db.patch(args.messageId, { reactions });
  },
});
