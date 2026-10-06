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

- Signed-in screens live under src/routes/_authenticated/ with AppShell owning the realtime ticket subscription and notifications — one subscriber avoids duplicate toasts.
- Thermal printing goes through src/lib/printer.ts (Web Bluetooth + raw ESC/POS) — no backend involved, works on Chrome Android.
- Ticket exit marks exited_at with a conditional update (exited_at IS NULL) — prevents double use across devices.
