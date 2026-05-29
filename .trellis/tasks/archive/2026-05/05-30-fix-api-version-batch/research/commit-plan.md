# Commit Plan

## AI-edited files (this session)

### Commit 1: feat(leaderboard): add API versioning and server config UI
- `worker/src/index.ts` — M1: API routes `/api/v1/...` + M3: D1 batch transaction
- `packages/core/src/leaderboardClient.ts` — M1: sync API paths
- `src/renderer/views/Settings.tsx` — Add server URL config, remove update/about sections
- `src/renderer/views/About.tsx` — New page for update and about
- `src/renderer/App.tsx` — Add "关于" navigation entry

## Unrecognized files (NOT in commit)
- `.trellis/tasks/05-30-fix-api-version-batch/` — Task artifacts
- `.trellis/tasks/05-30-review-cf-workers-d1/` — Review task artifacts
