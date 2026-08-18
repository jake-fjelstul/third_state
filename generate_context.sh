#!/usr/bin/env bash
set -euo pipefail

# Ensure script is run from repository root
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$GIT_ROOT" ] || [ "$GIT_ROOT" != "$PWD" ] || [ ! -f "package.json" ]; then
  echo "Error: generate_context.sh must be run from the repository root." >&2
  exit 1
fi

mkdir -p context

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

HEADER="# Generated: ${TIMESTAMP}
# Commit:    ${COMMIT}
# Branch:    ${BRANCH}"

# -----------------------------------------------------------------------------
# 1. Generate context/project-structure.txt
# -----------------------------------------------------------------------------
STRUCT_FILE="context/project-structure.txt"
echo "$HEADER" > "$STRUCT_FILE"
echo "" >> "$STRUCT_FILE"

# === TREE ===
echo "=== TREE ===" >> "$STRUCT_FILE"
TREE_DIRS=()
for d in src supabase admin/src ios/App/App scripts; do
  if [ -d "$d" ]; then
    TREE_DIRS+=("$d")
  fi
done

if [ ${#TREE_DIRS[@]} -gt 0 ]; then
  find "${TREE_DIRS[@]}" -type f \
    \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sql" -o -name "*.json" -o -name "*.swift" -o -name "*.plist" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "ios/App/App/public/*" \
    ! -path "*/keys/*" \
    ! -name "*.p8" \
    ! -name ".env*" | sort >> "$STRUCT_FILE"
fi
echo "" >> "$STRUCT_FILE"

# === FILE SIZES ===
echo "=== FILE SIZES ===" >> "$STRUCT_FILE"
FS_DIRS=()
for d in src admin/src; do
  if [ -d "$d" ]; then
    FS_DIRS+=("$d")
  fi
done

if [ ${#FS_DIRS[@]} -gt 0 ]; then
  find "${FS_DIRS[@]}" -type f \( -name "*.js" -o -name "*.jsx" \) -exec wc -l {} + | grep -v ' total$' | sort -rn -k1,1 >> "$STRUCT_FILE" || true
fi
echo "" >> "$STRUCT_FILE"

# === EXPORTS ===
echo "=== EXPORTS ===" >> "$STRUCT_FILE"
if [ ${#FS_DIRS[@]} -gt 0 ]; then
  grep -rn --include="*.js" --include="*.jsx" "^export " "${FS_DIRS[@]}" | sort >> "$STRUCT_FILE" || true
fi
echo "" >> "$STRUCT_FILE"

# === IMPORTS ===
echo "=== IMPORTS ===" >> "$STRUCT_FILE"
if [ ${#FS_DIRS[@]} -gt 0 ]; then
  grep -rn --include="*.js" --include="*.jsx" "^import .* from " "${FS_DIRS[@]}" | sort >> "$STRUCT_FILE" || true
fi
echo "" >> "$STRUCT_FILE"

# === RPC CALLS ===
echo "=== RPC CALLS ===" >> "$STRUCT_FILE"
if [ ${#FS_DIRS[@]} -gt 0 ]; then
  grep -rn "supabase\.rpc(" "${FS_DIRS[@]}" | sort >> "$STRUCT_FILE" || true
fi
echo "" >> "$STRUCT_FILE"

# === TABLE ACCESS ===
echo "=== TABLE ACCESS ===" >> "$STRUCT_FILE"
if [ ${#FS_DIRS[@]} -gt 0 ]; then
  grep -rn "supabase\.from(" "${FS_DIRS[@]}" | sort >> "$STRUCT_FILE" || true
fi
echo "" >> "$STRUCT_FILE"

# === EDGE FUNCTION INVOCATIONS ===
echo "=== EDGE FUNCTION INVOCATIONS ===" >> "$STRUCT_FILE"
if [ ${#FS_DIRS[@]} -gt 0 ]; then
  grep -rn "functions\.invoke(" "${FS_DIRS[@]}" | sort >> "$STRUCT_FILE" || true
fi
echo "" >> "$STRUCT_FILE"

# === MIGRATION LIST ===
echo "=== MIGRATION LIST ===" >> "$STRUCT_FILE"
if [ -d "supabase/migrations" ]; then
  ls -1 supabase/migrations/ >> "$STRUCT_FILE"
fi

# -----------------------------------------------------------------------------
# 2. Generate context/database-schema.sql
# -----------------------------------------------------------------------------
SCHEMA_FILE="context/database-schema.sql"
SOURCE_TYPE=""

SUPABASE_DB_URL=""
if [ -f ".env.local" ]; then
  SUPABASE_DB_URL=$(grep -E "^SUPABASE_DB_URL=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
fi

PG_DUMP=""
if [ -x "/opt/homebrew/opt/libpq/bin/pg_dump" ]; then
  PG_DUMP="/opt/homebrew/opt/libpq/bin/pg_dump"
elif command -v pg_dump &>/dev/null; then
  PG_DUMP=$(command -v pg_dump)
fi

DUMP_SUCCESS=false
PG_DUMP_ERR=""

if [ -n "$PG_DUMP" ] && [ -n "$SUPABASE_DB_URL" ]; then
  TEMP_DUMP=$(mktemp)
  TEMP_ERR=$(mktemp)

  if "$PG_DUMP" --schema-only --schema=public --no-owner --no-privileges \
       -f "$TEMP_DUMP" "$SUPABASE_DB_URL" 2>"$TEMP_ERR"; then
    DUMP_LINES=$(wc -l < "$TEMP_DUMP" 2>/dev/null || echo 0)
    if [ "$DUMP_LINES" -ge 100 ]; then
      SOURCE_TYPE="live pg_dump"
      SCHEMA_HEADER="${HEADER}
# Source:    ${SOURCE_TYPE}"
      echo "$SCHEMA_HEADER" > "$SCHEMA_FILE"
      echo "" >> "$SCHEMA_FILE"
      cat "$TEMP_DUMP" >> "$SCHEMA_FILE"
      DUMP_SUCCESS=true
    else
      PG_DUMP_ERR="pg_dump generated insufficient output ($DUMP_LINES lines, expected >= 100)"
    fi
  else
    PG_DUMP_ERR=$(cat "$TEMP_ERR")
  fi

  rm -f "$TEMP_DUMP" "$TEMP_ERR"
else
  if [ -z "$PG_DUMP" ]; then
    PG_DUMP_ERR="pg_dump executable not found."
  elif [ -z "$SUPABASE_DB_URL" ]; then
    PG_DUMP_ERR="SUPABASE_DB_URL is not set in .env.local."
  fi
fi

if [ "$DUMP_SUCCESS" = false ]; then
  SOURCE_TYPE="migration concatenation"
  SCHEMA_HEADER="${HEADER}
# Source:    ${SOURCE_TYPE}"
  echo "$SCHEMA_HEADER" > "$SCHEMA_FILE"
  echo "" >> "$SCHEMA_FILE"
  cat << 'EOF' >> "$SCHEMA_FILE"
# ============================================================
# WARNING: MIGRATION CONCATENATION, NOT A LIVE SCHEMA DUMP.
# This is append-only migration history. Later migrations may
# drop or replace objects defined earlier. Do not treat any
# single definition here as current.
# ============================================================
EOF
  echo "" >> "$SCHEMA_FILE"
  if [ -d "supabase/migrations" ]; then
    for mig in $(ls -1 supabase/migrations/*.sql 2>/dev/null | sort); do
      echo "-- File: $mig" >> "$SCHEMA_FILE"
      cat "$mig" >> "$SCHEMA_FILE"
      echo "" >> "$SCHEMA_FILE"
    done
  fi

  echo "WARNING: live schema dump failed, using migration concatenation." >&2
  if [ -n "$PG_DUMP_ERR" ]; then
    if [ -n "$SUPABASE_DB_URL" ]; then
      REDACTED_ERR=$(echo "$PG_DUMP_ERR" | sed "s|${SUPABASE_DB_URL}|[REDACTED_DB_URL]|g")
      echo "$REDACTED_ERR" >&2
    else
      echo "$PG_DUMP_ERR" >&2
    fi
  fi
fi

echo "Source: $SOURCE_TYPE"
echo "Generated file line counts:"
wc -l context/project-structure.txt context/database-schema.sql
