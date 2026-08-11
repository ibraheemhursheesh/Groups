import { seedTestAccounts } from "@/app/actions/seed";

export default function SeedPage() {
  return (
    <form action={seedTestAccounts}>
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        Create 20 test accounts
      </button>
    </form>
  );
}
