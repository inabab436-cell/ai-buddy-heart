<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Product image uploads are manual-only: never auto-analyze images or auto-fill product fields, because merchants assign colours themselves.
- Keep dashboard-specific visual tokens scoped under `.hub-dashboard` so the wider merchant hub retains its existing theme.
- Platform admin console lives at /admin with its own encrypted cookie; every admin server fn re-checks it, because route guards don't protect RPC endpoints.
- Site identity displays only merchant-provided logos, without a platform-logo fallback, to avoid reintroducing removed AI artwork.
- Merchant authentication returns a setup-aware destination consumed directly by sign-in screens, so new accounts reach onboarding before the dashboard.
- `src/server.ts` imports the TanStack server entry statically (not via dynamic import), because the lazy import made the bundler emit a circular chunk that crashed every published page with "__exportAll is not a function".
