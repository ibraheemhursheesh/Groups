"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function PostForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("groupId", groupId);
    await createPost(formData);
    formRef.current?.reset();
    setLoading(false);
    router.refresh();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mb-6">
      <input type="hidden" name="groupId" value={groupId} />
      <Textarea
        name="content"
        placeholder="Write a post..."
        rows={3}
        required
        disabled={loading}
        className="mb-3"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
