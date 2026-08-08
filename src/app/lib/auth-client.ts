import { createAuthClient } from "better-auth/react";
import { organizationClient, anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [organizationClient(), anonymousClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
