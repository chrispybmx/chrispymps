#!/usr/bin/env bash
#
# verifica.sh — la guardia prima di pubblicare.
#
# Regola non negoziabile del progetto: UN RIDER DEVE SEMPRE POTER AGGIUNGERE
# UNO SPOT. Tutto il resto e' migliorabile, quello no.
#
# Perche' questo file esiste. Il 19/08/2026 e' stata aggiunta la categoria
# `transition` al selettore ma non all'elenco che il server accetta. Per CINQUE
# GIORNI la prima casella del selettore rispondeva «Dati non validi» a ogni
# invio, con le foto gia' caricate. In quei cinque giorni: tsc pulito, ESLint
# pulito, 122 test verdi, build verde.
#
# Nessun controllo statico puo' vedere quel bug. Serviva una richiesta vera a
# un server vero. Questo script fa quelle richieste, sempre le stesse, e le fa
# fare anche a chi non sapeva che andassero fatte.
#
# USO
#   ./scripts/verifica.sh                          → contro il server locale
#   ./scripts/verifica.sh https://maps.chrispybmx.com → contro la produzione
#
# Esce con codice 1 se qualcosa non va. Se esce 0, si puo' pubblicare.
#
# NOTA sulle richieste di invio spot: si fermano tutte sul token finto, PRIMA
# di scrivere qualsiasi cosa. Non creano spot. Il limite e' 10 invii ogni 5
# minuti per IP, e questo script ne fa 8: se lo lanci due volte di fila il
# secondo giro prende 429, che lo script riconosce e ti dice.

set -uo pipefail

BASE="${1:-http://127.0.0.1:3000}"
LOCALE=$([[ "$BASE" == *"127.0.0.1"* || "$BASE" == *"localhost"* ]] && echo si || echo no)

ROSSO=$'\033[31m'; VERDE=$'\033[32m'; GIALLO=$'\033[33m'; GRIGIO=$'\033[90m'; FINE=$'\033[0m'
ERRORI=0
AVVISI=0

titolo() { printf '\n%s── %s %s\n' "$GRIGIO" "$1" "$FINE"; }
ok()     { printf '   %s✓%s %s\n' "$VERDE" "$FINE" "$1"; }
ko()     { printf '   %s✗%s %s\n' "$ROSSO" "$FINE" "$1"; ERRORI=$((ERRORI+1)); }
nota()   { printf '   %s!%s %s\n' "$GIALLO" "$FINE" "$1"; AVVISI=$((AVVISI+1)); }

stato() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$1"; }

# Un invio di prova. Si ferma sul token finto: non scrive niente.
# Restituisce il codice HTTP.
invio() {
  local corpo="$1"
  curl -s -o /tmp/.verifica_risposta -w '%{http_code}' --max-time 20 \
    -X POST "$BASE/api/submit-spot" \
    -H 'Content-Type: application/json' -d "$corpo"
}

FOTO_FINTA="https://aoiuzmidvbfukemkhajk.supabase.co/storage/v1/object/public/spot-photos/x.jpg"

printf '\n%sVerifica Chrispy Maps%s   %s\n' "$VERDE" "$FINE" "$BASE"

# ═══════════════════════════════════════════════════════════════
titolo "1. Il sito risponde"
# ═══════════════════════════════════════════════════════════════
if [[ "$(stato /)" == "200" ]]; then ok "la home risponde"; else
  ko "la home NON risponde — mi fermo, il resto non ha senso"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════
titolo "2. AGGIUNGERE UNO SPOT — il vincolo che non si rompe"
# ═══════════════════════════════════════════════════════════════

# Le categorie che il selettore offre davvero, lette da lib/constants.ts.
# Se il file non e' leggibile (verifica su produzione da un'altra macchina) si
# usa l'elenco noto.
if [[ -f lib/constants.ts ]]; then
  CATEGORIE=$(node -e "
    const s = require('fs').readFileSync('lib/constants.ts','utf8');
    const m = s.match(/TIPI_SPOT[^=]*=\s*\{([\s\S]*?)\n\};/);
    const t = [...m[1].matchAll(/^\s{2}(\w+):\s*\{([^}]*)\}/gm)]
      .filter(x => /contesto:\s*true/.test(x[2])).map(x => x[1]);
    console.log(t.join(' '));
  " 2>/dev/null)
fi
CATEGORIE="${CATEGORIE:-street park plaza diy trail pumptrack}"

printf '   %scategorie offerte dal selettore: %s%s\n' "$GRIGIO" "$CATEGORIE" "$FINE"

LIMITE_RAGGIUNTO=no
for cat in $CATEGORIE; do
  c=$(invio "{\"name\":\"verifica\",\"type\":\"$cat\",\"lat\":45.4,\"lon\":11.0,\"photo_urls\":[\"$FOTO_FINTA\"],\"access_token\":\"finto\"}")
  case "$c" in
    401) ok "categoria «$cat» accettata dal server" ;;
    422) ko "categoria «$cat» RESPINTA — un rider che la sceglie non riesce a inviare"
         printf '        %s%s%s\n' "$GRIGIO" "$(cat /tmp/.verifica_risposta)" "$FINE" ;;
    429) nota "limite di invii raggiunto sulla categoria «$cat» — riprova fra 5 minuti"
         LIMITE_RAGGIUNTO=si; break ;;
    *)   ko "categoria «$cat» ha risposto $c, atteso 401" ;;
  esac
done

if [[ "$LIMITE_RAGGIUNTO" == "no" ]]; then
  # Gli ostacoli: campo nuovo, deve essere accettato.
  c=$(invio "{\"name\":\"verifica\",\"type\":\"street\",\"ostacoli\":[\"rail\",\"stairs\"],\"lat\":45.4,\"lon\":11.0,\"photo_urls\":[\"$FOTO_FINTA\"],\"access_token\":\"finto\"}")
  [[ "$c" == "401" ]] && ok "gli ostacoli vengono accettati" || ko "ostacoli respinti (HTTP $c)"

  # Un errore deve dire QUALE campo. Il vecchio «Controlla tutti i campi» ha
  # tenuto un rider bloccato per giorni senza sapere dove guardare.
  c=$(invio "{\"name\":\"verifica\",\"type\":\"inventata\",\"lat\":45.4,\"lon\":11.0,\"photo_urls\":[\"$FOTO_FINTA\"],\"access_token\":\"finto\"}")
  if [[ "$c" == "422" ]] && grep -q 'categoria' /tmp/.verifica_risposta; then
    ok "gli errori dicono quale campo e' sbagliato"
  else
    ko "un errore di validazione non dice quale campo (HTTP $c)"
  fi
fi

# Senza autenticazione non si scrive.
c=$(invio "{\"name\":\"verifica\",\"type\":\"street\",\"lat\":45.4,\"lon\":11.0,\"photo_urls\":[\"$FOTO_FINTA\"],\"access_token\":\"finto\"}")
[[ "$c" == "401" || "$c" == "429" ]] && ok "senza sessione valida non si crea nulla" \
  || ko "un token finto NON viene respinto (HTTP $c)"

# ═══════════════════════════════════════════════════════════════
titolo "3. La mappa ha dentro qualcosa"
# ═══════════════════════════════════════════════════════════════
curl -s --max-time 25 "$BASE/api/spots" -o /tmp/.verifica_spot
node -e '
  const fs = require("fs");
  let j; try { j = JSON.parse(fs.readFileSync("/tmp/.verifica_spot","utf8")); }
  catch { console.log("ROTTO|risposta non leggibile"); process.exit(0); }
  if (!j.ok) { console.log("ROTTO|" + (j.error ?? "risposta non ok")); process.exit(0); }
  const s = j.data ?? [];
  console.log([
    s.length,
    s.filter(x => x.cover_url).length,
    s.filter(x => (x.photo_urls ?? []).length > 1).length,
  ].join("|"));
' > /tmp/.verifica_mappa

IFS='|' read -r N COP MULTI < /tmp/.verifica_mappa
if [[ "$N" == "ROTTO" ]]; then
  ko "/api/spots non funziona: $COP"
elif [[ "${N:-0}" -lt 1 ]]; then
  ko "la mappa e' VUOTA — nessuno spot restituito"
else
  ok "$N spot, $COP con copertina, $MULTI con piu' di una foto"
  [[ "$COP" -lt "$N" ]] && nota "$((N-COP)) spot senza copertina"
fi

# ═══════════════════════════════════════════════════════════════
titolo "4. Le pagine che contano"
# ═══════════════════════════════════════════════════════════════
controlla() {
  local c; c=$(stato "$1")
  [[ "$c" == "$2" ]] && ok "$1 → $c" || ko "$1 → $c (atteso $2)"
}
controlla /map 200
controlla /sfoglia 200
controlla /preferiti 200
controlla /admin/conferma 200
controlla /map/citta-inesistente-xyz 404
controlla /news/non-esiste 404

# ═══════════════════════════════════════════════════════════════
titolo "5. Le porte chiuse restano chiuse"
# ═══════════════════════════════════════════════════════════════
c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/api/admin/approvati")
[[ "$c" == "401" ]] && ok "l'admin richiede la sessione" || ko "/api/admin/approvati risponde $c, atteso 401"

# Le GET di moderazione non devono cambiare niente: rimandano alla conferma.
for r in "approve" "reject"; do
  c=$(stato "/api/admin/$r?token=finto")
  [[ "$c" == "307" ]] && ok "GET $r rimanda alla conferma, non decide" \
    || ko "GET $r risponde $c — dovrebbe solo rimandare (307)"
done

# ═══════════════════════════════════════════════════════════════
if [[ "$LOCALE" == "si" ]]; then
titolo "6. Controlli statici (solo in locale)"
  npx tsc --noEmit >/tmp/.verifica_tsc 2>&1 \
    && ok "tipi puliti" || { ko "errori di tipo"; head -5 /tmp/.verifica_tsc | sed 's/^/        /'; }
  npx vitest run >/tmp/.verifica_test 2>&1 \
    && ok "$(grep -oE 'Tests +[0-9]+ passed' /tmp/.verifica_test | tail -1)" \
    || { ko "test falliti"; grep -E '×|FAIL' /tmp/.verifica_test | head -5 | sed 's/^/        /'; }
fi

# ═══════════════════════════════════════════════════════════════
printf '\n'
if [[ "$ERRORI" -eq 0 ]]; then
  printf '%s TUTTO A POSTO %s' "$VERDE" "$FINE"
  [[ "$AVVISI" -gt 0 ]] && printf '  (%d avvisi)' "$AVVISI"
  printf '\n\n'
  exit 0
else
  printf '%s %d PROBLEMI — non pubblicare %s\n\n' "$ROSSO" "$ERRORI" "$FINE"
  exit 1
fi
