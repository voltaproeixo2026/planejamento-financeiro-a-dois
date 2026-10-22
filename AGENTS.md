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

- Keep the reference shell styling scoped to `.household-shell`; leaf screen layouts remain independent so visual migration can proceed one screen at a time.
- Theme switching sets `data-theme` on the document only and defaults to system preference; it never uses financial persistence or browser storage.
- The shell reuses the existing exported debt view for its dedicated navigation entry; finance calculations and Supabase persistence remain in their existing modules.
