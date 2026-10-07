import { createFileRoute, redirect } from "@tanstack/react-router";

// Customer accounts were removed — old links go to order tracking.
export const Route = createFileRoute("/c/$slug/account")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/track", params: { slug: params.slug }, replace: true });
  },
});
