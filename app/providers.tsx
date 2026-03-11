"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not defined. Please check your environment variables.");
} else if (convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost")) {
  if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
    console.warn(
      "The application is using a local Convex URL (" + convexUrl + ") in a non-local environment (" + window.location.hostname + "). " +
      "This will likely cause connection failures. Please update your environment variables in Vercel."
    );
  }
}

const convex = new ConvexReactClient(convexUrl as string);

import { ThemeProvider } from "@/components/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ThemeProvider>
  );
}
