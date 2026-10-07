import { createFileRoute } from "@tanstack/react-router";

import { CustomerChat } from "@/components/customer/customer-chat";

export const Route = createFileRoute("/chat/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "new" ? "new" : "continue") as "new" | "continue",
  }),
  head: ({ params }) => {
    const brand = params.slug;
    return {
      meta: [
        { title: `محادثة العملاء — ${brand}` },
        { name: "description", content: `دردشة عملاء ${brand}.` },
        { property: "og:title", content: `محادثة العملاء — ${brand}` },
        { property: "og:description", content: `دردشة عملاء ${brand}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ChatPage,
});

function ChatPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch() as { mode?: "new" | "continue" };
  const mode: "new" | "continue" = search.mode === "new" ? "new" : "continue";

  return <CustomerChat slug={slug} mode={mode} />;
}
