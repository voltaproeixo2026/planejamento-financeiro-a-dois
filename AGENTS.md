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
- The dedicated debt screen owns DebtEditor and multi-month forecasts; the summary owns the income scenario, and goals never render either, to avoid duplicated screen responsibilities.
- Additive presentation models live in `src/lib/planning-model.ts` and delegate to existing finance functions; keep existing financial formulas and persistence unchanged, and store optional goal entries in the existing household JSON for backward compatibility without schema changes.
- Summary allocation percentages and debt display fields belong to the presentation model; income simulation passes an extras-free state to the existing financial summary so its full-income endpoint still excludes extras without changing core formulas.
- Debt reference metadata is optional in the existing household JSON; editDebt synchronizes firstDue with ref/ref_ym while preserving paidCount and overrides, and forecast/debtChanges delegate to the established finance calculations to keep legacy data and all screens consistent.
- Division controls and person display fields use the presentation model and existing summarize/transferPlan functions; optional splitMethod metadata in household JSON preserves the selected control without schema changes, and styles stay scoped to the division screen.
