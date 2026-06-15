#!/usr/bin/env bash
set -u

echo "🚀 Setup Claude Code stack per ChrispyMPS"
echo "----------------------------------------"

# Safety: deve essere lanciato dentro il progetto
if [ ! -f "package.json" ]; then
  echo "❌ Non vedo package.json."
  echo "Apri il terminale dentro la cartella del progetto ChrispyMPS e rilancia lo script."
  exit 1
fi

echo "✅ package.json trovato. Sembra una cartella progetto."

# Utility safe runner: non blocca tutto se un plugin fallisce
run_step() {
  echo ""
  echo "▶️ $1"
  shift
  "$@"
  local status=$?
  if [ $status -ne 0 ]; then
    echo "⚠️ Step non riuscito: $*"
    echo "   Continua comunque. Potrai rifarlo manualmente."
  else
    echo "✅ Fatto"
  fi
}

# 1. Controllo Git
echo ""
echo "🔍 Controllo Git..."
if command -v git >/dev/null 2>&1; then
  git status --short
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  echo "Branch attuale: $CURRENT_BRANCH"

  if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo ""
    echo "⚠️ Sei su $CURRENT_BRANCH."
    echo "Creo un branch sicuro per lavorare senza rompere produzione..."
    git checkout -b feature/claude-safe-setup || true
  fi
else
  echo "⚠️ Git non trovato. Installalo prima possibile."
fi

# 2. Homebrew
echo ""
if ! command -v brew >/dev/null 2>&1; then
  echo "⚠️ Homebrew non trovato."
  echo "Installalo da https://brew.sh poi rilancia questo script."
  echo "Non lo installo automaticamente per sicurezza."
else
  echo "✅ Homebrew trovato"
fi

# 3. Node.js
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    run_step "Installazione Node.js via Homebrew" brew install node
  else
    echo "❌ Node.js non trovato e Homebrew assente."
    echo "Installa Node.js 20+ e rilancia."
    exit 1
  fi
else
  echo "✅ Node trovato: $(node -v)"
fi

# 4. Claude Code
if ! command -v claude >/dev/null 2>&1; then
  run_step "Installazione Claude Code via npm" npm install -g @anthropic-ai/claude-code
else
  echo "✅ Claude Code trovato: $(claude --version 2>/dev/null || echo 'versione non rilevata')"
fi

# 5. Dipendenze progetto
run_step "Installazione dipendenze progetto" npm install

# 6. ccusage: controllo consumo token
run_step "Test ccusage token monitor" npx -y ccusage@latest

# 7. Rust + RTK
if ! command -v cargo >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    run_step "Installazione Rust/Cargo via Homebrew" brew install rust
  else
    echo "⚠️ Cargo non trovato. RTK richiede Rust/Cargo."
  fi
fi

if command -v cargo >/dev/null 2>&1; then
  run_step "Installazione RTK da GitHub" cargo install --git https://github.com/rtk-ai/rtk
fi

if command -v rtk >/dev/null 2>&1; then
  run_step "Verifica RTK gain" rtk gain
  run_step "Setup RTK globale con prompt interattivo" rtk init -g
else
  echo "⚠️ RTK non installato. Puoi rifare dopo: cargo install --git https://github.com/rtk-ai/rtk"
fi

# 8. Caveman plugin
run_step "Aggiunta marketplace Caveman" claude plugin marketplace add JuliusBrussee/caveman
run_step "Installazione Caveman" claude plugin install caveman@caveman

# 9. Supabase plugin ufficiale
run_step "Aggiunta marketplace Supabase plugin" claude plugin marketplace add supabase-community/supabase-plugin
run_step "Installazione Supabase plugin" claude plugin install supabase@supabase

# 10. Vercel MCP
run_step "Aggiunta Vercel MCP" claude mcp add --transport http vercel https://mcp.vercel.com

# 11. Chrome DevTools MCP
run_step "Aggiunta Chrome DevTools MCP" claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest

# 12. Playwright MCP
run_step "Aggiunta Playwright MCP" claude mcp add playwright -- npx @playwright/mcp@latest

# 13. Context7 MCP
run_step "Aggiunta Context7 MCP" claude mcp add context7 -- npx -y @upstash/context7-mcp

# 14. Sentry MCP
run_step "Aggiunta Sentry MCP" npx -y add-mcp https://mcp.sentry.dev/mcp

# 15. Vercel plugin ufficiale opzionale
run_step "Installazione Vercel plugin per coding agent" npx -y plugins add vercel/vercel-plugin

# 16. Crea istruzioni progetto sicure se CLAUDE.md non esiste
if [ ! -f "CLAUDE.md" ]; then
  echo ""
  echo "🛡️ Creo CLAUDE.md con regole sicurezza progetto..."
  cat > CLAUDE.md <<'EOF'
# ChrispyMPS — Claude Code Rules

You are working on ChrispyMPS, a live production app.

Core stack:
- Next.js App Router
- TypeScript
- Supabase
- Leaflet
- Vercel
- PWA/mobile-first direction

Safety rules:
1. Never work directly on main/master.
2. Never expose or print secrets.
3. Never edit .env, .env.local, or production credentials unless explicitly asked.
4. Never use SUPABASE_SERVICE_ROLE_KEY in frontend code.
5. Before editing files, inspect the project and create a short plan.
6. Work one feature at a time.
7. Do not rewrite the whole app.
8. Preserve existing map behavior unless the task is specifically about the map.
9. After editing, list modified files and give test commands.
10. Always run typecheck/build when relevant.
11. Keep responses concise.
12. Prefer small reversible commits.
13. Respect mobile performance.
14. Respect prefers-reduced-motion for animations.
15. Do not modify database schema, RLS, storage policies or auth without a clear migration plan.

Default response style:
- Short plan before changes
- Modified files after changes
- Risks
- Test steps
EOF
  echo "✅ CLAUDE.md creato"
else
  echo "✅ CLAUDE.md esiste già. Non lo tocco."
fi

echo ""
echo "🎯 Setup completato."
echo ""
echo "Prossimi step:"
echo "1. Lancia Claude Code:"
echo "   claude"
echo ""
echo "2. Dentro Claude, fai login se richiesto."
echo ""
echo "3. Apri MCP manager:"
echo "   /mcp"
echo ""
echo "4. Autentica Vercel, Supabase, Sentry, GitHub se richiesto."
echo ""
echo "5. Attiva Caveman se vuoi risparmiare token:"
echo "   /caveman"
echo ""
echo "6. Primo prompt consigliato:"
echo ""
echo "   Audit this project. Do not modify files. Check architecture, Supabase safety, PWA readiness, mobile UX, Vercel deployment risk, and animation/performance opportunities."
echo ""
echo "🔥 ChrispyMPS pronto per lavorare serio."
