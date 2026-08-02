"use server";
import { auth } from "@/app/lib/auth";
import { redirect } from "next/navigation";

import { headers } from "next/headers";

export const signIn = async () => {
  const { url } = await auth.api.signInSocial({
    body: {
      provider: "google",
    },
  });
  console.log("url", url);
  if (url) redirect(url);
};

export const signOut = async () => {
  await auth.api.signOut({
    headers: await headers(),
  });
  redirect("/");
};
