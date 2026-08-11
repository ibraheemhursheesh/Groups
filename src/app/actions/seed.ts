"use server";

import { auth } from "@/app/lib/auth";

export async function seedTestAccounts(_formData: FormData) {
  const ctx = await auth.$context;

  for (let i = 1; i <= 20; i++) {
    const email = `user${i}@test.local`;
    const password = "password123";

    try {
      const user = await ctx.internalAdapter.createUser({
        id: `seed-user-${i}`,
        name: `Test User ${i}`,
        email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await ctx.password.hash(password),
      });
    } catch {
      // Skip duplicates
    }
  }
}
