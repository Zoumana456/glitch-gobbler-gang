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
- AI report agents: orchestrator advances one agent_tasks step per server call (src/lib/agents); numbers are computed deterministically, AI only plans and writes — keeps runs traceable and within worker time limits.
- Report assistant edits drafts via atomic patch operations applied by src/lib/report-patch.ts (AI never rewrites the full report) — guarantees untouched content and photos survive edits.
