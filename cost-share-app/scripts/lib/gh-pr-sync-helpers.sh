#!/usr/bin/env bash
# Shared helpers for gh-pr-sync-with-dev.sh (source only; not executed directly).
# shellcheck shell=bash

# GitHub occasionally returns this while a PR head ref is settling after push/update-branch.
is_transient_head_ref_error() {
  local msg="$1"
  [[ "$msg" == *"Could not resolve head ref"* ]] ||
    [[ "$msg" == *"repository.pullRequest.baseRef.compare"* ]]
}

gh_pr_head_sha() {
  local pr_number="$1" repo="$2"
  gh pr view "$pr_number" --repo "$repo" --json headRefOid --jq '.headRefOid'
}

# Retry gh pr view / headRefOid when GraphQL head ref is briefly unavailable.
resolve_pr_head_sha_with_retry() {
  local pr_number="$1" repo="$2"
  local max_attempts="${3:-6}"
  local delay="${4:-5}"
  local attempt=1 err_file
  err_file="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$err_file'" RETURN

  while (( attempt <= max_attempts )); do
    if gh_pr_head_sha "$pr_number" "$repo" 2>"$err_file"; then
      rm -f "$err_file"
      return 0
    fi
    if is_transient_head_ref_error "$(cat "$err_file")"; then
      echo "::warning::PR head ref not ready (attempt ${attempt}/${max_attempts}); retrying in ${delay}s" >&2
      sleep "$delay"
      if (( delay < 30 )); then delay=$(( delay + 5 )); fi
      attempt=$(( attempt + 1 ))
      continue
    fi
    cat "$err_file" >&2
    rm -f "$err_file"
    return 1
  done
  cat "$err_file" >&2
  rm -f "$err_file"
  return 1
}

gh_pr_update_branch_with_retry() {
  local pr_number="$1" repo="$2"
  local max_attempts="${3:-6}"
  local delay="${4:-5}"
  local attempt=1 err_file
  err_file="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$err_file'" RETURN

  while (( attempt <= max_attempts )); do
    if gh pr update-branch "$pr_number" --repo "$repo" 2>"$err_file"; then
      rm -f "$err_file"
      return 0
    fi
    local err
    err="$(cat "$err_file")"
    if is_transient_head_ref_error "$err"; then
      echo "::warning::update-branch head ref flake (attempt ${attempt}/${max_attempts}); retrying in ${delay}s" >&2
      sleep "$delay"
      if (( delay < 30 )); then delay=$(( delay + 5 )); fi
      attempt=$(( attempt + 1 ))
      continue
    fi
    printf '%s\n' "$err" >&2
    rm -f "$err_file"
    return 1
  done
  local err
  err="$(cat "$err_file")"
  printf '%s\n' "$err" >&2
  rm -f "$err_file"
  if is_transient_head_ref_error "$err"; then
    return 2
  fi
  return 1
}
