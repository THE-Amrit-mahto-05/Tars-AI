import { Doc, Id } from "@/convex/_generated/dataModel";

export const PRESET_ICONS = [
    "https://api.dicebear.com/7.x/shapes/svg?seed=1",
    "https://api.dicebear.com/7.x/shapes/svg?seed=2",
    "https://api.dicebear.com/7.x/shapes/svg?seed=3",
    "https://api.dicebear.com/7.x/shapes/svg?seed=4",
    "https://api.dicebear.com/7.x/shapes/svg?seed=5",
    "https://api.dicebear.com/7.x/shapes/svg?seed=6",
];

export interface Conversation extends Doc<"conversations"> {
    otherUser: (Doc<"users"> & { isOnline: boolean }) | null;
    lastMessage: {
        body: string;
        _creationTime: number;
        isSystem?: boolean;
    } | null;
    typingUserName: string | null;
    unreadCount?: number;
    groupDetails?: {
        name?: string;
        description?: string;
        icon?: string;
        participantCount: number;
        adminId?: Id<"users">;
    } | null;
}
