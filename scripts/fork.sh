#!/usr/bin/env bash
set -euo pipefail

MAIN=main
UPSTREAM=${UPSTREAM:-upstream}
CHECKS=${CHECKS:-"yarn install --immutable && yarn format/check && yarn typecheck && yarn lint && yarn build && yarn test/unit"}
FORK_ONLY_DELETED=(.github/workflows/release.yml .github/workflows/draft-release.yml .github/workflows/edge.yml add-ons/ps5-mqtt-edge)

die() { echo "fork.sh: $*" >&2; exit 1; }

usage() {
  cat <<EOF
usage: scripts/fork.sh <command>
  start <name>   branch feature/<name> off $MAIN
  finish         check the current feature branch, then merge it into $MAIN
  sync [ref]     merge $UPSTREAM/$MAIN (or ref) on feature/sync-upstream-*, then finish
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
  check_fork_invariants
  echo "fork.sh: running checks on $branch"
  bash -c "$CHECKS" || die "checks failed; $MAIN untouched, still on $branch"
  git switch -q "$MAIN"
  git merge -q --no-ff "$branch" -m "Merge branch '$branch'"
  git branch -q -d "$branch"
  echo "fork.sh: merged $branch into $MAIN. Push with: git push fork $MAIN"
}

resolve_fork_conflicts() {
  local p
  for p in "${FORK_ONLY_DELETED[@]}"; do
    git rm -rq --ignore-unmatch -- "$p"
  done
  if git checkout -q --ours -- repository.yaml 2>/dev/null; then
    git add repository.yaml
  fi
}

sync() {
  local ref=${1:-$UPSTREAM/$MAIN} branch
  require_clean
  git fetch -q "$UPSTREAM" --tags
  git merge-base --is-ancestor "$ref" "$MAIN" && { echo "fork.sh: $MAIN already contains $ref"; return; }
  branch="feature/sync-upstream-$(git describe --tags --always "$ref" | tr '/' '-')"
  git switch -q "$MAIN"
  git switch -q -c "$branch"
  if ! git merge -q --no-ff "$ref" -m "Merge $ref into $MAIN"; then
    resolve_fork_conflicts
    if [ -n "$(git diff --name-only --diff-filter=U)" ]; then
      git diff --name-only --diff-filter=U
      die "resolve the conflicts above, git commit, then run: scripts/fork.sh finish"
    fi
    git commit -q --no-edit
  fi
  finish
}

case "${1:-}" in
  start) shift; start "$@" ;;
  finish) finish ;;
  sync) shift; sync "$@" ;;
  *) usage ;;
esac
