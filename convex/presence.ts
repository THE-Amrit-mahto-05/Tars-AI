import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return;

    const existing = await ctx.db
      .query("userPresence")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReadTime: Date.now(),
      });
    } else {
      await ctx.db.insert("userPresence", {
        userId: user._id,
        conversationId: args.conversationId,
        lastReadTime: Date.now(),
      });
    }
  },
});

export const getUnreadCount = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return 0;

    const presence = await ctx.db
      .query("userPresence")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId)
      )
      .unique();

    const lastReadTime = presence?.lastReadTime ?? 0;

    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
      .filter((q) => q.neq(q.field("authorId"), user._id))
      .collect();

    return unreadMessages.length;
  },
});
