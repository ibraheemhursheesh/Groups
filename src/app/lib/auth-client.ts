import { createAuthClient } from "better-auth/react";
import { organizationClient, anonymousClient, multiSessionClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [organizationClient(), anonymousClient(), multiSessionClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
