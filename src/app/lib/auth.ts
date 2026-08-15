import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/index";
import { nextCookies } from "better-auth/next-js";
import { organization as orgPlugin, anonymous, multiSession } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { user, session, account, verification, organization, member as memberTable, invitation } from "@/db/schema";
import { generateUniqueHandle } from "@/app/lib/handle-server";

const ac = createAccessControl({
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  organization: ["update", "delete"],
});

const admin = ac.newRole({
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  organization: ["update", "delete"],
});

const member = ac.newRole({
  member: [],
  invitation: [],
  organization: [],
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, organization, member: memberTable, invitation },
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  user: {
    additionalFields: {
      // `input: false` keeps these out of the public signup payload — a handle
      // may only be claimed through the validated `setHandle` server action.
      handle: {
        type: "string",
        required: false,
        input: false,
      },
      handleConfirmed: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Runs for every provider (Google, email/password, anonymous), so a
        // user row can never exist without a handle. Users pick their real one
        // afterwards at /onboarding/handle.
        before: async (newUser) => {
          const handle = await generateUniqueHandle({
            email: newUser.email,
            name: newUser.name,
            isAnonymous: (newUser as { isAnonymous?: boolean | null })
              .isAnonymous,
          });
          return { data: { ...newUser, handle, handleConfirmed: false } };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    orgPlugin({
      ac,
      roles: { admin, member },
      allowUserToCreateOrganization: true,
      creatorRole: "admin",
      sendInvitationEmail: async () => {},
    }),
    anonymous(),
    multiSession(),
    nextCookies(),
  ],
});
