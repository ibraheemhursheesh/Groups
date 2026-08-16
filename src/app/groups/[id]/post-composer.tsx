"use client";

import { useState } from "react";
import { PostForm } from "./post-form";
import { VaulDrawer, useIsMobile } from "@/components/ui/vaul-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusIcon, ZapIcon } from "lucide-react";

interface PostComposerProps {
  groupId: string;
  isAdmin: boolean;
  onOptimisticSubmit: (formData: FormData) => void;
}

const BULK_POSTS = [
  "Just spent the entire afternoon debugging a CSS issue that turned out to be a missing semicolon. Three hours of my life I'll never get back. The worst part is I was so confident it was a server-side rendering problem that I went down a complete rabbit hole restructuring my component hierarchy. Lesson learned: always check the simple things first before assuming the worst. Has anyone else had one of those days where the simplest bug takes the longest to find? I swear the universe has a sense of humor when it comes to software development.",
  "I've been thinking a lot about how we structure our team meetings lately. We currently do standups every morning at 9am, but half the team is in a different timezone and they're always groggy and disengaged. What if we switched to async standups where everyone posts their update in a thread by noon their local time? We tried this at my previous company and it actually improved communication because people wrote more thoughtful updates instead of rushing through a verbal summary. The written format also created a searchable history that was incredibly useful for tracking project progress over time.",
  "Weekend project update: I'm building a home automation system using Raspberry Pi and some custom sensors. Got the temperature and humidity monitoring working across three rooms. The data feeds into a local Grafana dashboard that shows trends over the past week. Next step is adding smart plugs so I can automatically turn on the humidifier when levels drop below 40%. The whole setup cost less than fifty dollars in hardware, which is way cheaper than any commercial solution. Open source for the win! I'll share the repo once I clean up the code a bit.",
  "Book recommendation for anyone interested in distributed systems: I just finished reading 'Designing Data-Intensive Applications' by Martin Kleppmann and it completely changed how I think about database design and system architecture. The chapters on replication and partitioning are especially good. He explains complex concepts like consensus algorithms and linearizability in a way that actually makes sense. It took me about three weeks to get through it because I kept stopping to take notes and look up references. Highly recommend reading it with a notebook handy.",
  "Hot take: most code comments are a sign that the code isn't clear enough on its own. Instead of writing a comment explaining what a function does, rename the function to make its purpose obvious. Instead of commenting a complex condition, extract it into a well-named boolean variable. The only comments worth writing are the ones that explain WHY something is done a certain way, not WHAT it does. That said, I recognize there are exceptions, especially when dealing with business logic that has non-obvious requirements or regulatory constraints that aren't apparent from the code alone.",
  "Our team just migrated from REST to GraphQL for our main API and the results have been fascinating. On the positive side, frontend developers love the flexibility of querying exactly what they need, and we've seen a significant reduction in over-fetching. Mobile app performance improved noticeably because we're sending less data over the wire. On the negative side, caching became more complex, and we had to invest significant time in setting up proper query complexity analysis to prevent abuse. The N+1 query problem also bit us hard initially until we implemented DataLoader properly across all our resolvers.",
  "I attended a local tech meetup last night about accessibility in web development and it was eye-opening. The speaker demonstrated how screen readers interact with modern JavaScript frameworks and showed how many common UI patterns are completely broken for visually impaired users. Things I took for granted, like drag-and-drop interfaces and infinite scroll, can be nightmarish without proper ARIA labels and keyboard navigation. I came home and immediately started auditing our application. Found at least twenty issues in the first hour of testing. We need to do better as an industry.",
  "Unpopular opinion: pair programming is one of the most overrated practices in software development. Don't get me wrong, it has its place for onboarding new team members or tackling genuinely complex problems. But making it a daily practice for routine work is a massive productivity drain. Two senior developers working independently on separate features will almost always deliver more value than the same two developers sitting together on one feature. The knowledge sharing benefits can be achieved more efficiently through thorough code reviews and good documentation. Fight me on this one.",
  "Just discovered that our production database has been running without proper connection pooling for the past six months. We were opening a new connection for every single request, which explains the mysterious latency spikes we've been seeing during peak hours. The fix was literally adding three lines of configuration. I ran load tests before and after, and p99 latency dropped from 800ms to 120ms. Sometimes the biggest wins come from the most basic infrastructure improvements. Going to spend the rest of the week auditing our other services for similar oversights.",
  "Random shower thought about programming: we spend years learning how to write code, but almost no time learning how to delete it. Some of the best refactoring sessions I've had involved removing thousands of lines of dead code, unused dependencies, and over-engineered abstractions that nobody needed. There's a certain satisfaction in watching a pull request with more red than green. Every line of code is a liability — it needs to be maintained, tested, understood, and debugged. The best code is the code that doesn't exist. If you haven't done a codebase cleanup in a while, I highly recommend scheduling one.",
];

export function PostComposer({ groupId, isAdmin, onOptimisticSubmit }: PostComposerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSubmit = (fd: FormData) => {
    onOptimisticSubmit(fd);
    setOpen(false);
  };

  const handleBulkCreate = () => {
    const shuffled = [...BULK_POSTS].sort(() => Math.random() - 0.5);
    for (const text of shuffled) {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("content", text);
      fd.append("images", new File([], ""));
      onOptimisticSubmit(fd);
    }
  };

  const trigger = (
    <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
      <PlusIcon className="size-5" />
    </Button>
  );

  const isDev = process.env.NODE_ENV === "development";

  const bulkButton = isDev ? (
    <Button size="icon" variant="outline" className="h-12 w-12 rounded-full shadow-lg" onClick={handleBulkCreate}>
      <ZapIcon className="size-5" />
    </Button>
  ) : null;

  if (isMobile) {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        {bulkButton}
        <VaulDrawer open={open} onOpenChange={setOpen} trigger={trigger}>
          <h2 className="mb-3 text-lg font-semibold">New post</h2>
          <PostForm groupId={groupId} isAdmin={isAdmin} onOptimisticSubmit={handleSubmit} />
        </VaulDrawer>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      {bulkButton}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
            <DialogDescription>
              Share something with the group.
            </DialogDescription>
          </DialogHeader>
          <PostForm groupId={groupId} isAdmin={isAdmin} onOptimisticSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
