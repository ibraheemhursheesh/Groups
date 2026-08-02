"use server";
import { auth } from "@/app/lib/auth";

export const signIn = async () => {
  // server-side usage
  await auth.api.signInSocial({
    body: {
      provider: "google", // or any other provider id
    },
  });
};
