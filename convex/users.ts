import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    let userId;
    if (user !== null) {
      await ctx.db.patch(user._id, {
        name: identity.name ?? "Anonymous",
        image: identity.pictureUrl ?? "",
        isOnline: true,
        lastSeen: Date.now(),
      });
      userId = user._id;
    } else {
      userId = await ctx.db.insert("users", {
        name: identity.name ?? "Anonymous",
        email: identity.email ?? "",
        image: identity.pictureUrl ?? "",
        clerkId: identity.subject,
        isOnline: true,
        lastSeen: Date.now(),
      });
    }

    const aiUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", "ai-bot"))
      .unique();

    if (aiUser && userId !== aiUser._id) {
      const existingConv = await ctx.db
        .query("conversations")
        .filter((q) =>
          q.and(
            q.eq(q.field("isGroup"), false),
            q.or(
              q.and(q.eq(q.field("participantOne"), userId), q.eq(q.field("participantTwo"), aiUser._id)),
              q.and(q.eq(q.field("participantOne"), aiUser._id), q.eq(q.field("participantTwo"), userId))
            )
          )
        )
        .first();

      if (!existingConv) {
        await ctx.db.insert("conversations", {
          participantOne: userId,
          participantTwo: aiUser._id,
          isGroup: false,
        });
      }
    }

    return userId;
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, {
        lastSeen: Date.now(),
        isOnline: true,
      });
    }
  },
});

export const offline = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, {
        isOnline: false,
        lastSeen: Date.now(),
      });
    }
  },
});

export const searchByEmail = query({
  args: { emailQuery: v.string() },
  handler: async (ctx, { emailQuery }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Privacy Guard: Don't return anything if the search is too short
    if (emailQuery.length < 3) return [];

    const users = await ctx.db
      .query("users")
      .withSearchIndex("search_email", (q) => q.search("email", emailQuery))
      .take(5);

    return users
      .filter((user) => user.clerkId !== identity.subject)
      .map((user) => ({
        ...user,
        isOnline: user.isOnline && (Date.now() - (user.lastSeen ?? 0) < 25000),
      }));
  },
});

export const getAllUsersDebug = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const ensureAIUser = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", "ai-bot"))
      .unique();

    if (existing) {
      if (existing.name !== "Tars AI") {
        await ctx.db.patch(existing._id, { name: "Tars AI" });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      name: "Tars AI",
      email: "ai@tars.local",
      image: "https://api.dicebear.com/7.x/bottts/svg?seed=tars",
      clerkId: "ai-bot",
      isOnline: true,
      isAI: true,
    });
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});
