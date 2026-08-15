import { createAuthClient } from "better-auth/react";
import { organizationClient, anonymousClient, multiSessionClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/app/lib/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [
    organizationClient(),
    anonymousClient(),
    multiSessionClient(),
    // Surfaces `handle` / `handleConfirmed` on the client session type.
    inferAdditionalFields<typeof auth>(),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
