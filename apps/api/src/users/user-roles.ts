export const USER_ROLES = ["admin", "editor", "operator", "viewer"] as const;

export type UserRole = (typeof USER_ROLES)[number];
