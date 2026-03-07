import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.string(),
    clerkId: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.optional(v.number()),
    isAI: v.optional(v.boolean()),
  }).index("by_clerkId", ["clerkId"]),

  messages: defineTable({
    body: v.string(),
    authorId: v.id("users"),
    conversationId: v.id("conversations"),
    isDeleted: v.optional(v.boolean()),
    isSystem: v.optional(v.boolean()),
    reactions: v.optional(v.array(v.object({
      user: v.id("users"),
      emoji: v.string(),
    }))),
  }).index("by_conversation", ["conversationId"]),

  conversations: defineTable({
    participantOne: v.optional(v.id("users")),
    participantTwo: v.optional(v.id("users")),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    isGroup: v.optional(v.boolean()),
    participants: v.optional(v.array(v.id("users"))),
    adminId: v.optional(v.id("users")),
    typingUser: v.optional(v.id("users")),
    storageId: v.optional(v.id("_storage")),
  }),

  userPresence: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    lastReadTime: v.number(),
  })
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_conversation", ["conversationId"]),
});
