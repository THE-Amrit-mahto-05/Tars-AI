import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [], // Disabled to prevent 5-6s latency on every request since auth is handled by Convex
}
