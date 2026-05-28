# Fix PC Auto-Update 404 Error on latest.yml

## Problem

PC (Electron) auto-update fails with HTTP 404 when checking for updates. The update service tries to fetch `latest.yml` from:
```
https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/latest.yml
```
This URL requires a **GitHub Release** to exist for the `desktop-latest` tag, but the release workflow only creates a **git tag** — not a GitHub Release.

### Root Cause

In `.github/workflows/release.yml`, the `publish-release` job:
1. Creates a GitHub Release for the versioned tag (e.g., `desktop-v2.0.6`) with all assets
2. Force-pushes a `desktop-latest` git tag pointing to the same commit

But it never creates a GitHub Release for `desktop-latest`. GitHub's `/releases/download/{tag}/{asset}` URL pattern requires an actual Release object, so the URL returns 404.

## Fix

Add a step in `release.yml` that creates/updates a GitHub Release for the `desktop-latest` tag and uploads the same build artifacts to it. This makes the existing feed URLs work without changing any application code.

### Why not change the URL to `/releases/latest/download/`?

This repo has both desktop and mobile releases. `/releases/latest/download/` points to the most recent release overall — which could be a mobile release. The tag-based approach (`desktop-latest`) is correct for this multi-platform repo.

### Why `--latest=false`?

The `desktop-latest` release should NOT be marked as GitHub's "latest" release, as that could interfere with mobile releases. It's a utility release for the update mechanism.

## Changes

### File: `.github/workflows/release.yml`

After the existing "Update desktop-latest tag" step, add a new step:

```yaml
- name: Update desktop-latest release
  env:
    GH_TOKEN: ${{ github.token }}
    GH_REPO: ${{ github.repository }}
  run: |
    set -euo pipefail
    shopt -s nullglob

    assets=(release-assets/*)
    if [ ${#assets[@]} -eq 0 ]; then
      echo "::error::No release assets found for desktop-latest"
      exit 1
    fi

    if gh release view desktop-latest --repo "$GH_REPO" >/dev/null 2>&1; then
      gh release upload desktop-latest "${assets[@]}" --clobber --repo "$GH_REPO"
    else
      gh release create desktop-latest "${assets[@]}" \
        --title "desktop-latest" \
        --notes "Auto-updated to $RELEASE_TAG" \
        --latest=false \
        --repo "$GH_REPO"
    fi
```

No changes needed to `updateService.ts` or `electron-builder.yml` — the existing URLs are correct once the Release object exists.

## Verification

After the next desktop release, confirm:
1. `https://github.com/zzzdajb/DickHelper/releases/download/desktop-latest/latest.yml` returns 200
2. PC app can check for updates without 404
