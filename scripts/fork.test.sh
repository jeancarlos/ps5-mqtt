#!/usr/bin/env bash
set -euo pipefail

FORK_SH=$(realpath "$(dirname "$0")/fork.sh")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail() { echo "FAIL: $*" >&2; exit 1; }

setup() {
  rm -rf "$TMP/up" "$TMP/work"
  git init -q -b main "$TMP/up"
  cd "$TMP/up"
  mkdir -p .github/workflows add-ons/ps5-mqtt
  echo "on: release" > .github/workflows/release.yml
  echo 'url: "https://github.com/FunkeyFlo/ps5-mqtt"' > repository.yaml
  echo "image: ghcr.io/funkeyflo/ps5-mqtt-home-assistant-add-on" > add-ons/ps5-mqtt/config.yaml
  echo one > app.txt
  git add -A && git commit -qm init
  git clone -q "$TMP/up" "$TMP/work"
  cd "$TMP/work"
  git remote rename origin upstream
  git rm -q .github/workflows/release.yml
  echo 'url: "https://github.com/jeancarlos/ps5-mqtt"' > repository.yaml
  echo "image: ghcr.io/jeancarlos/ps5-mqtt-home-assistant-add-on" > add-ons/ps5-mqtt/config.yaml
  git commit -qam fork
}

upstream_commit() {
  (cd "$TMP/up" && eval "$1" && git add -A && git commit -qm "$2")
}

grep '^CHECKS=' "$FORK_SH" | grep -qE 'yarn [a-z]+/' && fail "a bare 'yarn script/name' runs yarn install, not the script"
echo "ok: default checks run slash-named scripts through yarn run"

setup
upstream_commit "echo two > app.txt" "upstream change"
CHECKS=true bash "$FORK_SH" sync >/dev/null
[ "$(git branch --show-current)" = main ] || fail "sync did not end on main"
[ "$(cat app.txt)" = two ] || fail "upstream change not merged"
git branch --list 'feature/*' | grep -q . && fail "feature branch left behind"
echo "ok: clean upstream change merges into main"

setup
upstream_commit "echo two > app.txt" "upstream change"
before=$(git rev-parse main)
CHECKS=false bash "$FORK_SH" sync >/dev/null 2>&1 && fail "sync succeeded with failing checks"
[ "$(git rev-parse main)" = "$before" ] || fail "main moved although checks failed"
[[ $(git branch --show-current) == feature/sync-upstream-* ]] || fail "not left on the sync branch"
echo "ok: failing checks leave main untouched"

setup
upstream_commit "echo 'on: [release, push]' > .github/workflows/release.yml && echo 'url: \"https://github.com/FunkeyFlo/ps5-mqtt\" # moved' > repository.yaml" "upstream edits fork-deleted and fork-owned files"
CHECKS=true bash "$FORK_SH" sync >/dev/null
[ ! -e .github/workflows/release.yml ] || fail "release.yml came back"
grep -q jeancarlos repository.yaml || fail "repository.yaml lost the fork url"
echo "ok: fork-deleted and fork-owned conflicts resolve to the fork side"

setup
CHECKS=true bash "$FORK_SH" sync | grep -q "already contains" || fail "no-op sync not reported"
echo "ok: nothing to sync"

setup
(cd "$TMP/up" && git tag v1)
git fetch -q upstream --tags
upstream_commit "echo two > app.txt" "upstream release bump"
(cd "$TMP/up" && git tag -f v1 >/dev/null)
CHECKS=true bash "$FORK_SH" sync >/dev/null
[ "$(git rev-parse v1)" = "$(git -C "$TMP/up" rev-parse v1)" ] || fail "moved upstream tag not followed"
echo "ok: an upstream tag moved by its release job does not break sync"

setup
CHECKS=true bash "$FORK_SH" start demo >/dev/null 2>&1
echo three > app.txt && git commit -qam feature
echo "image: ghcr.io/funkeyflo/x" > add-ons/ps5-mqtt/config.yaml && git commit -qam "breaks invariant"
CHECKS=true bash "$FORK_SH" finish >/dev/null 2>&1 && fail "finish merged a branch that broke the image invariant"
git revert --no-edit HEAD >/dev/null
CHECKS=true bash "$FORK_SH" finish >/dev/null
[ "$(cat app.txt)" = three ] || fail "feature not merged"
echo "ok: start/finish gate a feature branch"
