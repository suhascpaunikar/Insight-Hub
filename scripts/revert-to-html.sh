#!/usr/bin/env bash
#
# Put the working tree back to the no-build-step HTML prototype.
#
# The console was ported onto @cloudflare/kumo's real components, which are
# React — so it gained a bundler and lost "clone it and open index.html".
# `html-prototype-v1` tags the last commit before that, where the design system
# was mirrored by hand in plain CSS and vanilla ES modules.
#
#   scripts/revert-to-html.sh --check     what would change, and nothing else
#   scripts/revert-to-html.sh             restore it (asks first)
#   scripts/revert-to-html.sh --yes       restore it without asking
#
# This stays on your current branch and leaves the commit to you, so the revert
# is an ordinary commit on top of the port rather than a rewrite of it. Nothing
# in history is touched either way: the port's commits stay exactly where they
# are, and `git checkout -` on a clean tree brings the Kumo build straight back.
set -euo pipefail

REF="html-prototype-v1"
YES=0
CHECK=0

for arg in "$@"; do
  case "$arg" in
    --check|-n) CHECK=1 ;;
    --yes|-y)   YES=1 ;;
    --help|-h)  sed -n '3,17p' "$0" | sed 's|^# \?||'; exit 0 ;;
    *) echo "revert-to-html: unknown option '$arg' (try --help)" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

# The tag is the whole mechanism, so say so plainly rather than failing on a
# git error three lines later. A shallow or partial clone is the usual cause.
if ! git rev-parse --verify --quiet "$REF^{commit}" >/dev/null; then
  cat >&2 <<EOF
revert-to-html: no such ref '$REF'.

It is a tag, and tags are not fetched by a shallow clone. Try:

    git fetch --tags origin

EOF
  exit 1
fi

# A revert that silently ate uncommitted work would be the worst possible
# failure here, so it is refused rather than merged around.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "revert-to-html: you have uncommitted changes. Commit or stash them first." >&2
  git status --short >&2
  exit 1
fi

TARGET="$(git rev-parse --short "$REF^{commit}")"
echo "Restoring the HTML prototype from $REF ($TARGET)."
echo

# `--no-renames`, because the question here is what lands and what goes, not
# what moved: a module the port carried from assets/js to src/lib is one rename
# to git and two events to anyone reading this summary.
CHANGES="$(git diff --name-status --no-renames HEAD "$REF")"
if [ -z "$CHANGES" ]; then
  echo "Already there — the tree matches $REF."
  exit 0
fi

# The diff runs HEAD → tag, so its A is a file the tag has and HEAD does not:
# the revert brings it back. Its D is the mirror of that.
echo "$CHANGES" | awk '
  $1 == "A" { add++; next }   # in the tag, not in HEAD → restored by the revert
  $1 == "D" { del++; next }   # in HEAD, not in the tag → removed by it
            { mod++ }
  END {
    printf "  %4d files restored\n", add + 0
    printf "  %4d files removed\n",  del + 0
    printf "  %4d files changed\n",  mod + 0
  }'
echo

if [ "$CHECK" = 1 ]; then
  echo "$CHANGES" | sed 's/^/  /'
  echo
  echo "(--check: nothing was changed.)"
  exit 0
fi

if [ "$YES" != 1 ]; then
  printf "This replaces the working tree. Continue? [y/N] "
  read -r reply
  case "$reply" in [yY]*) ;; *) echo "Cancelled."; exit 1 ;; esac
fi

# `read-tree -u --reset` is the one that also *deletes* what the target does
# not have — `git checkout <ref> -- .` would restore assets/ and leave src/
# sitting beside it, which is the half-reverted state that runs neither build.
# HEAD is left alone, so you are still on your branch with a staged revert.
git read-tree -u --reset "$REF"

# Untracked leftovers the index never knew about — dist/ and node_modules/ are
# gitignored, so read-tree does not touch them, and an old dist/ would be
# served by the static server as if it were the prototype.
rm -rf dist

cat <<EOF
Done. The working tree is the HTML prototype, staged and ready to commit:

    git commit -m "Revert to the no-build-step HTML prototype"

Run it with no install at all:

    python3 -m http.server 8000     # then open http://localhost:8000

To go back to the Kumo build instead of committing:

    git reset --hard HEAD

node_modules/ was left in place; it is ignored by git and harmless either way.
EOF
