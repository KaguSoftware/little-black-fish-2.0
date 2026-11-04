/** Password rules shared by the change-password action and its form ("use server" files can only export async functions). */
export const PASSWORD_MIN = 10;
/** bcrypt, which Supabase uses, ignores everything past 72 bytes. */
export const PASSWORD_MAX = 72;
