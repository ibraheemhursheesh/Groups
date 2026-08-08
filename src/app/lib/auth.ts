import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/index";
import { nextCookies } from "better-auth/next-js";
import { organization as orgPlugin, anonymous } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { user, session, account, verification, organization, member as memberTable, invitation } from "@/db/schema";

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
    nextCookies(),
  ],
});
