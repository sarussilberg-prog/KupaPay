#!/usr/bin/env bash
# Start TestFlight iOS when a dev PR merge should ship mobile bits but pull_request:closed did not run
# (squash merges performed by github-actions[bot] do not trigger other workflows — GitHub #31100).
set -euo pipefail

pr_number="${1:?PR number required}"
repo="${2:?owner/repo required}"

token="${ADMIN_PAT:-${GH_TOKEN:-}}"
if [[ -z "$token" ]]; then
  echo "::error::ADMIN_PAT or GH_TOKEN required to dispatch TestFlight"
  exit 1
fi

export GH_TOKEN="$token"

run=false
while IFS= read -r path; do
  case "$path" in
    cost-share-app/apps/mobile/eas.json|.github/workflows/testflight-ios.yml|.github/workflows/testflight-ios-dev-merge.yml|cost-share-app/apps/mobile/components/GroupCard.tsx|cost-share-app/apps/mobile/components/groupCardLayout.ts|cost-share-app/apps/mobile/components/ui/iconLabelLayout.ts|cost-share-app/apps/mobile/hooks/useRtlLayout.tsx|cost-share-app/apps/mobile/lib/groupsLayoutDiagnostics.ts|cost-share-app/apps/mobile/lib/groupsCardLayoutLimits.ts)
      run=true
      break
      ;;
  esac
done < <(gh pr view "$pr_number" --repo "$repo" --json files --jq '.files[].path')

if [[ "$run" != "true" ]]; then
  echo "TestFlight dev-merge: no mobile release paths in PR #$pr_number — skip"
  exit 0
fi

echo "Dispatching TestFlight iOS for dev tip (PR #$pr_number mobile release paths)"
gh workflow run "TestFlight iOS" --repo "$repo" --ref dev -f pro_enabled=true
