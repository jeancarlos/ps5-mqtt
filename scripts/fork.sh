#!/usr/bin/env bash
set -euo pipefail

MAIN=main
UPSTREAM=${UPSTREAM:-upstream}
FORK=${FORK:-fork}
FORK_REPO=${FORK_REPO:-jeancarlos/ps5-mqtt}
CHECKS=${CHECKS:-"yarn install --immutable && scripts/fork.sh format-check && yarn typecheck && yarn lint && yarn build && yarn run test/unit"}
FORK_ONLY_DELETED=(.github/workflows/release.yml .github/workflows/draft-release.yml .github/workflows/edge.yml add-ons/ps5-mqtt-edge)

die() { echo "fork.sh: $*" >&2; exit 1; }

usage() {
  cat <<EOF
usage: scripts/fork.sh <command>
  start <name>   branch feature/<name> off $MAIN
  finish         rebase the current feature branch onto $MAIN, check it, then move $MAIN to it
  sync [ref]     replay the fork's commits onto $UPSTREAM/$MAIN (or ref) on feature/sync-upstream-*, then finish
  publish        force-push $MAIN to $FORK, lifting the force-push rule only for that push
EOF
  exit 1
}

require_clean() {
  [ -z "$(git status --porcelain)" ] || die "working tree is not clean"
}

check_fork_invariants() {
  local p
  for p in "${FORK_ONLY_DELETED[@]}"; do
    [ ! -e "$p" ] || die "$p is back; the fork deletes it"
  done
  grep -q '^image: ghcr.io/jeancarlos/' add-ons/ps5-mqtt/config.yaml || die "config.yaml image no longer points at ghcr.io/jeancarlos"
  grep -q 'jeancarlos/ps5-mqtt' repository.yaml || die "repository.yaml no longer points at the fork"
}

start() {
  [ -n "${1:-}" ] || usage
  require_clean
  git switch -q "$MAIN"
  git switch -c "feature/$1"
}

finish() {
  local branch
  branch=$(git branch --show-current)
  [[ $branch == feature/* ]] || die "not on a feature/* branch (on '$branch')"
  require_clean
  if [[ $branch != feature/sync-upstream-* ]]; then
    git rebase -q "$MAIN" || die "rebasing $branch onto $MAIN hit conflicts; resolve them, git rebase --continue, then rerun finish"
  fi
  check_fork_invariants
  echo "fork.sh: running checks on $branch"
  bash -c "$CHECKS" || die "checks failed; $MAIN untouched, still on $branch"
  git switch -q "$MAIN"
  git reset -q --hard "$branch"
  git branch -q -D "$branch"
  echo "fork.sh: $MAIN now at $branch. Publish with: scripts/fork.sh publish"
}

format_check() {
  local f files=()
  while IFS= read -r -d '' f; do
    if git cat-file -e "$UPSTREAM/$MAIN:$f" 2>/dev/null \
      && ! git show "$UPSTREAM/$MAIN:$f" | yarn prettier --check --stdin-filepath "$f" >/dev/null 2>&1; then
      continue
    fi
    files+=("$f")
  done < <(git diff -z --name-only --diff-filter=d "$UPSTREAM/$MAIN"...)
  [ ${#files[@]} -eq 0 ] || yarn prettier --check --ignore-unknown "${files[@]}"
}

unmerged() {
  git diff --name-only --diff-filter=U
}

rebasing() {
  [ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ]
}

resolve_fork_conflicts() {
  local p
  for p in "${FORK_ONLY_DELETED[@]}"; do
    git rm -rq --ignore-unmatch -- "$p"
  done
  if unmerged | grep -qx repository.yaml; then
    git checkout -q --theirs -- repository.yaml
    git add repository.yaml
  fi
}

replay_onto() {
  local onto=$1 base=$2
  git rebase -q --onto "$onto" "$base" >/dev/null 2>&1 && return
  while rebasing; do
    resolve_fork_conflicts
    if [ -n "$(unmerged)" ]; then
      unmerged
      die "resolve the conflicts above, git add them, git rebase --continue, then run: scripts/fork.sh finish"
    fi
    if ! GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 && [ -z "$(unmerged)" ] && git diff --cached --quiet; then
      git rebase --skip >/dev/null 2>&1 || true
    fi
  done
}

sync() {
  local ref=${1:-$UPSTREAM/$MAIN} branch
  require_clean
  git fetch -q --tags --force "$UPSTREAM"
  git merge-base --is-ancestor "$ref" "$MAIN" && { echo "fork.sh: $MAIN already contains $ref"; return; }
  branch="feature/sync-upstream-$(git describe --tags --always "$ref" | tr '/' '-')"
  git switch -q -c "$branch" "$MAIN"
  replay_onto "$ref" "$(git merge-base "$MAIN" "$ref")"
  finish
}

publish() {
  local id
  require_clean
  id=$(gh api "repos/$FORK_REPO/rulesets" --jq '.[] | select(.name == "protect main") | .id')
  [ -n "$id" ] || die "ruleset 'protect main' not found on $FORK_REPO"
  gh api -X PUT "repos/$FORK_REPO/rulesets/$id" -f enforcement=disabled >/dev/null
  # shellcheck disable=SC2064
  trap "gh api -X PUT 'repos/$FORK_REPO/rulesets/$id' -f enforcement=active >/dev/null" EXIT
  git fetch -q "$FORK"
  git -c core.quotepath=false push --force-with-lease "$FORK" "$MAIN"
}

case "${1:-}" in
  start) shift; start "$@" ;;
  finish) finish ;;
  format-check) format_check ;;
  sync) shift; sync "$@" ;;
  publish) publish ;;
  *) usage ;;
esac
