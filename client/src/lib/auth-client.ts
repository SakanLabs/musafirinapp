import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3000",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    adminClient()
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  admin,
} = authClient;