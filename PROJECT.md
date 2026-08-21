# Pulso Options Analyzer — Biblia del Project

Pega **este archivo** en un Grok Project. Si el agente solo puede leer una cosa, que sea esta.

| | |
|---|---|
| Producto | Pulso Options Analyzer |
| Versión | **WEB5.0 - V3.31** (`src/components/brand.tsx` → `APP_VERSION`) |
| Dueño | Roberto Escobar Citty |
| Repo | https://github.com/Roberto6669/pulso-opciones |
| Rama / tag | `main` · `v3.31` |
| Disco Mac Mini | `/Users/robertoescobar/Library/Mobile Documents/com~apple~CloudDocs/__DATA/_AI_Grok/opciones_analizador_WEB5.0` |
| Preview Grok | sandbox `/workspace`, **0.0.0.0:8080** |
| Host | Mac Mini M1 16GB · Docker · Tailscale |
| WEB4 (NO TOCAR) | `https://opciones-w4.tailac6c74.ts.net` — sigue vivo a propósito |

---

## 0. Cómo crear el Grok Project (Roberto)

En grok.com → **Projects** → **New**:

1. **Nombre:** `Pulso WEB5.0`
2. **Instructions:** pega la sección **12** de este archivo (el recuadro).
3. **Archivos:** sube este `PROJECT.md`. Si cabe, también `src/components/brand.tsx` y `src/routes/index.tsx` (opcional; el repo es la fuente).
4. Cada chat nuevo **dentro de ese Project** hereda las instructions. No hace falta re-explicar el producto.

Si el sandbox del chat está vacío: clonar el repo a `/workspace`, `npm install`, `npm run dev` en **8080**.

---

## 1. Dos mundos (no mezclar)

```
Grok (chat / Project)              Mac Mini de Roberto
─────────────────────              ────────────────────
/workspace  sandbox                iCloud DEST + Docker
edita + preview 8080               git clone, rebuild, Tailscale
NO tiene el Mac                    NO edita Grok
```

1. Programar en Grok. El preview de la derecha es la verdad.
2. Subir versión: `APP_VERSION` + tag GitHub `vX.Y`.
3. Bajar al DEST de iCloud con `git clone` (comandos abajo).
4. Rebuild Docker. WEB5 **independiente** de WEB4.

Nunca abrir un `index.html` suelto (prototipo v1.0). El app es **TanStack Start + React**.
Nunca apagar WEB4 para “actualizar” WEB5.

---

## 2. Qué es (una frase)

Escáner de **opciones** (default), también **acciones** y **ETF**.  
Presupuesto + días hasta vencimiento → contratos que caben, si **la acción** está bien y si **ese boleto** vale la pena. Español de calle.

No es consejo. No hay broker conectado. Precios: **Nasdaq → CBOE delayed → Yahoo** (gratis).  
IBKR: Roberto **sí tiene cuenta**. El API es gratis con Gateway en el Mini + OPRA. **Aún no está cableado**; el preview de Grok no puede hablar con localhost:5000.

---

## 3. Lo que el usuario ve

### Header
Monograma **RE** + **ROBERTO ESCOBAR CITTY** + badge `WEB5.0 - V3.31`.  
Cinta de índices SPY / Dow / Nasdaq / Russell / VIX + sparkline.  
Modo: **Opciones** (default) / Acciones / ETF.

### Look (V3.27+)
Referencia: iStock multi-monitor (fondo negro, cian neón, magenta, oro).  
Tokens en `src/styles.css`: `--color-bg #05070b`, `--color-accent #00e5d4`, SMA20 oro, SMA50 magenta.  
**Cero radios.** Rejilla cian sutil. No look infantil / redondeado.

### Izquierda — filtros
- Presupuesto: $25 $50 $100 $250 $500 $1,000
- DTE: ≤7 / 14 / 21–45 + min/max
- Botón grande **Próximo viernes**
- Lado: AUTO / CALLS / PUTS
- Símbolos **vacío** = universo **del día** (más activas), no una lista fija de 30
- Comisión IBKR en texto: $0.65/contrato + ~$0.03, mín. $1

Aviso rojo “1–7 días agresivo” usa **`dteMax` del filtro**, no el DTE de la fila abierta.

### Centro
Tabla: símbolo, minichart+BB, señal, score, strike, coste, spread, DTE, SÍ/MIRAR/NO.  
Al elegir: score, gráfica (velas + área cian + SMA 20/50/200 + Bollinger canal + RSI + MACD).  
Botón **Completa** / **Salir** (Esc) en la gráfica.  
Cajas SMA/BB: MALO / BUENO y % que falta.  
**¿Compro esto?** acción ≠ boleto + gráfica al break-even.  
Panel 1-2-3: Invertiste | Si llega la tesis | Promedio del modelo.

### Derecha — métricas
- Amarillo (`text-wait`) = **gasto** (prima, comisión)
- Rojo = pérdida
- Verde = ganancia

### Mobile
Ticket pegajoso arriba. Más info visible, menos scroll.

---

## 4. Cómo funciona por dentro

### Stack
TanStack Start · React · Tailwind v4 · Recharts · `createServerFn` · Vite **8080**.

### Datos — `src/lib/yahoo.server.ts`

Cadenas (`fetchOptionChain`), en este orden:

1. Nasdaq option-chain (3 reintentos + curl)
2. CBOE delayed `cdn.cboe.com/api/global/delayed_quotes/options/{SYM}.json`
3. Yahoo query1 / query2
4. Última cadena buena hasta **20 min** (stale)

Nunca vencimientos < ~0.75 días (0-DTE muerto).  
En 1–7 DTE junta **varios** vencimientos.

Auto-scan (`fetchHotUnderlyings` / `fetchHotUniverse`):

- OCC más activas de Yahoo (si el HTML responde)
- Nasdaq download: cap ≥ $8B, volumen ≥ 8M, top del día
- Siempre mete SPY QQQ IWM NVDA TSLA AAPL AMD META AMZN
- Máx ~40 tickers. El log dice **“Hoy se mueve: …”**

`SCAN_SYMBOLS` en `scan.ts` es **respaldo**, no el universo diario.

### Escaneo — `src/lib/market.fns.ts`

`scanBatch` de a 3 símbolos. Omite si vol. 20d < **1.5M**.  
`pickLegs`: cabe presupuesto **+ comisión**, strike **cerca** del spot, spread ok.

Acciones/ETF: `scanEquities` + `STOCK_SYMBOLS` / `ETF_SYMBOLS` en `equity.ts`.

### Score — `scoreContract` en `scan.ts`

Liquidez + técnico + dirección − spread.  
**Score alto ≠ cómpralo.** Eso es el subyacente. La compra es `actionFor`.

### Estimado — `estimate.ts`

IV+HV, BE con comisión, `pProfit` vía N(·), `expectedPnl` resta round-trip IBKR, `targetPnl` solo entrada, `maxLoss` = prima + abrir.

### Comisión — `fees.ts`

IBKR Pro Fixed US: opciones $0.65+$0.03 mín $1; acciones $0.005 mín $1; round-trip.

### SÍ / MIRAR / NO — `setup.ts` + `plain-why.tsx`

1. La **acción** (SMA/BB) puede ir bien.  
2. El **boleto** pide que el spot llegue al BE en N días.

- **NO** si el salto > ~2× movimiento típico o P < 9%
- **SÍ** si el salto cabe en 1σ y el técnico a favor
- **MIRAR** en el medio

**$25 y 2 días** casi siempre lotería. Correcto. No suavizar el modelo.

### Gráficas — `price-chart.tsx`

Área cian + glow, SMA gruesas, Bollinger = **canal entre bandas** (Customized path), velas con **la misma escala Y** (no Bar en el eje de precio: eso pegaba las medias arriba).  
Fullscreen: estado `full`, `fixed inset-0`, Esc.  
Bug ya arreglado V3.31: Area/Bar forzaban dominio a 0.

---

## 5. Archivos que importan

```
src/routes/index.tsx           UI, scan, tabla, filtros
src/components/brand.tsx       APP_VERSION, RE, nombre
src/components/plain-why.tsx   ¿Compro esto?
src/components/price-chart.tsx velas, SMA, BB, RSI, MACD, Completa
src/components/estimate-panel.tsx
src/components/option-ticket.tsx  mobile
src/components/market-strip.tsx
src/components/shell.tsx       header
src/styles.css                 tokens (negro/cian)
src/lib/yahoo.server.ts        Nasdaq / CBOE / Yahoo / hot universe
src/lib/market.fns.ts          scanBatch, fetchHotUniverse
src/lib/scan.ts                score, nextFriday, SCAN_SYMBOLS respaldo
src/lib/estimate.ts
src/lib/setup.ts
src/lib/fees.ts
src/lib/equity.ts
src/lib/analysis.ts            RSI MACD SMA BB
PROJECT.md                     este archivo
```

**No hay `index.html` de app en la raíz.** Si aparece, bórralo (`rm -f`).

---

## 6. Bajar al Mac (funciona)

Repo **público**. Tag = versión.

```bash
DEST="/Users/robertoescobar/Library/Mobile Documents/com~apple~CloudDocs/__DATA/_AI_Grok/opciones_analizador_WEB5.0"
mkdir -p "$DEST"
rm -rf /tmp/pulso-opciones
git clone --branch v3.31 --depth 1 https://github.com/Roberto6669/pulso-opciones.git /tmp/pulso-opciones
cp -R /tmp/pulso-opciones/. "$DEST"
rm -f "$DEST/index.html"
grep APP_VERSION "$DEST/src/components/brand.tsx"
```

Debe decir `WEB5.0 - V3.31`. Luego **rebuild Docker**. Copiar no actualiza el contenedor que ya corre.

`cp -R` no borra leftovers → por eso `rm -f index.html`.  
No `curl` zip si el repo está privado (9 bytes = Not Found).  
En zsh **no pegues comentarios `#`** (rompe el comando).

---

## 7. Subir desde Grok (agente)

1. `/tmp/pulso-push` = clone de `Roberto6669/pulso-opciones`
2. Copiar `/workspace/src` → repo (+ `PROJECT.md`, `VERSION`)
3. Bump `APP_VERSION` en `brand.tsx`
4. **No** commitear `index.html` v1.0
5. `git commit` + `git tag -f vX.Y` + push `main` + push tag + `gh release create`
6. GitHub: **Roberto6669**

---

## 8. Hosting Mac Mini

Reglas en su `CLAUDE.md` + `ports.json` (Claude arma el Docker).

- 1 proyecto = 1 Docker
- WEB4 puerto **10101** no se apaga
- WEB5 = **puerto nuevo** de `free_suggested`
- Tailscale hostname propio (`opciones-w5…`)
- IBKR Client Portal Gateway (cuando se cablee): Java en el host, Docker → `localhost:5000`, una sola sesión IBKR (TWS y Gateway no a la vez). OPRA ~$1.50/mes para opciones en vivo.

---

## 9. Marca / UX (no romper)

- Header WEB4-like: **RE** + nombre completo + versión
- Oscuro terminal, **sin esquinas redondas**
- Montos **2 decimales**
- Español claro (subyacente → la acción; contrato → boleto)
- Acción va bien ≠ compra este weekly
- iPhone: info arriba

---

## 10. Errores ya cometidos (no repetir)

| Síntoma | Causa | Arreglo |
|---|---|---|
| GitHub baja v1.0 | `index.html` prototipo | Borrarlo. App = `src/` |
| curl zip 9 bytes | repo privado | `git clone` o repo público |
| DEST vacío | `rm -rf "$DEST"` | clone a `/tmp` + `cp -R` |
| Sigue v1.0 | leftover + Docker viejo | `rm index.html` + rebuild |
| Siempre los mismos tickers | lista fija de 30 | universo del día V3.25 |
| Cero resultados | 0-DTE muerto | ignorar < 0.75d; varios venc. 1–7 |
| Todo NO | $25 + 2 DTE lotería | strikes cerca; no falsear |
| 14d no quita el rojo | aviso usaba DTE de fila | usar `dteMax` |
| EVITAR con SMA verde | técnico mezclado con boleto | dos cajas |
| $19 → $45,000 | estimado fantasioso | BS + HV; tesis ≠ promedio |
| Medias arriba, velas en medio | Area/Bar dominio 0 | Customized + `baseValue={yMin}` |
| `#` en Terminal zsh | comentario no es bash | comandos sin `#` |

---

## 11. IBKR (pendiente, no olvidar)

- Cuenta **sí**. API **gratis**. Retail = Client Portal Gateway en el Mini (login manual).
- OAuth sin Gateway = institucional, no aplica.
- Dato delayed gratis. Opciones en vivo = **OPRA**.
- Preview Grok **no** usa IBKR. Cuando Docker WEB5 esté estable, adapter con `IBKR_GATEWAY_URL`, Nasdaq/CBOE de respaldo.

---

## 12. Instructions del Grok Project (copiar TAL CUAL)

```
Eres Grok Build. Este Project es Pulso Options Analyzer (WEB5.0).

Lee primero PROJECT.md. Código: https://github.com/Roberto6669/pulso-opciones
(main; última tag = versión visible). Versión actual: WEB5.0 - V3.31.

Dueño: Roberto Escobar Citty.
Mac Mini M1 16GB: cada app en su Docker + Tailscale.
WEB4.0 (opciones-w4.tailac6c74.ts.net, puerto 10101) SIGUE VIVO. No apagarlo.
Disco WEB5:
/Users/robertoescobar/Library/Mobile Documents/com~apple~CloudDocs/__DATA/_AI_Grok/opciones_analizador_WEB5.0

Qué es: escáner de opciones (default) / acciones / ETF. Presupuesto + DTE.
Datos: Nasdaq (reintentos) → CBOE delayed → Yahoo → caché 20 min.
Auto-scan vacío = universo DEL DÍA (volumen/opciones activas), no 30 fijos.
Comisión IBKR en estimados. No es consejo ni broker.
IBKR API: Roberto tiene cuenta; Gateway en Mini pendiente de cablear. No llamar IBKR desde el sandbox de Grok.

Reglas:
- Cada cambio visible: bump APP_VERSION en src/components/brand.tsx (WEB5.0 - Vx.y) y tag GitHub.
- Header: monograma RE + ROBERTO ESCOBAR CITTY + versión.
- Look: negro/cian/magenta/oro, cero radios, terminal. Ref. iStock multi-monitor.
- Español claro. Acción ≠ boleto. Amarillo=gasto, rojo=pérdida, verde=ganancia.
- Weeklies $25 casi nunca SÍ; no falsear el modelo.
- Gráficas: velas, SMA, Bollinger EN LA MISMA escala Y; botón Completa/Esc.
- No crear index.html estático. No rm -rf el DEST del Mac.
- Preview sandbox 0.0.0.0:8080.
- Al “bajar versión”: git clone --branch vX.Y --depth 1, cp -R a DEST, rm -f index.html, grep APP_VERSION, rebuild Docker.
- Al retomar: git pull / clonar repo, leer PROJECT.md, NO reescribir el app desde cero.
```
