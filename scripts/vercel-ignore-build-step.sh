#!/usr/bin/env bash

# Vercel Deployment Filtering Script
# Exit code 1: Build will proceed.
# Exit code 0: Build is skipped (no relevant changes).

echo "Evaluating changes for Vercel frontend deployment..."

# 1. Fallback for initial commit or shallow clone
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "Initial commit or shallow clone detected. Proceeding with build."
  exit 1
fi

# 2. Inspect changed files between commits
CHANGED_FILES=$(git diff --name-only HEAD^ HEAD)
echo "Changed files:"
echo "$CHANGED_FILES"

# 3. Check if frontend or shared configuration files were modified
if echo "$CHANGED_FILES" | grep -E '^(frontend/|scripts/|package.json|\.github/)'; then
  echo "Relevant changes detected in frontend/ or shared root configuration. Proceeding with build."
  exit 1
else
  echo "Only backend or unrelated files changed. Skipping frontend build on Vercel."
  exit 0
fi
