# Pulso Options Analyzer — Biblia del proyecto

Úsala para **Grok Projects**, Claude, o un agente en un año.  
Si solo puedes pegar un archivo, pega **este**.

| | |
|---|---|
| Producto | Pulso Options Analyzer |
| Versión actual | **WEB5.0 - V3.24** (`src/components/brand.tsx` → `APP_VERSION`) |
| Dueño | Roberto Escobar Citty |
| Repo | https://github.com/Roberto6669/pulso-opciones |
| Rama | `main` · tag `v3.24` |
| Disco Mac Mini | `/Users/robertoescobar/Library/Mobile Documents/com~apple~CloudDocs/__DATA/_AI_Grok/opciones_analizador_WEB5.0` |
| Preview Grok | sandbox `/workspace`, puerto **8080** |
| Host producción | Mac Mini M1 16GB · Docker · Tailscale |
| Sitio viejo (NO tocar) | WEB4.0 → `opciones-w4.tailac6c74.ts.net` (sigue vivo a propósito) |

---

## 1. Cómo se trabaja (dos mundos)

```
Grok (este chat)          Mac Mini de Roberto
─────────────────         ────────────────────
/workspace  (sandbox)     iCloud DEST + Docker
edita, preview 8080       clona GitHub, rebuild, Tailscale
NO tiene el Mac           NO edita Grok
```

1. **Programar** aquí en Grok. El preview de la derecha es la verdad del código.
2. **Versionar** `APP_VERSION` en `src/components/brand.tsx` + tag GitHub.
3. **Bajar** al Mac con `git clone` / `cp` al DEST de iCloud.
4. **Correr** con Docker (Claude ya conoce `ports.json` / `CLAUDE.md` del Mini). WEB5 es independiente de WEB4.

Nunca abrir un `index.html` suelto: eso fue un prototipo v1.0. El app es **TanStack Start + React**.

Nunca borrar WEB4 para “actualizar” WEB5.

---

## 2. Qué es el producto (en una frase)

Escáner de **opciones** (default), también **acciones** y **ETF**.  
Tú pones **presupuesto** y **días hasta vencimiento**. El sistema busca contratos que quepan, te dice si el **subyacente** está bien y si **ese boleto** vale la pena, en español de calle.

No es consejo financiero. No hay broker conectado. Los precios salen de **Nasdaq / Yahoo** (públicos, gratis).

---

## 3. Lo que el usuario ve

### Header
Logo **RE** + **ROBERTO ESCOBAR CITTY** + versión `WEB5.0 - V3.24`.  
Cinta de índices (SPY, Dow, Nasdaq, Russell, VIX) con minigráfica.

### Izquierda — filtros
- Presupuesto chips: $25, $50, $100, $250, $500, $1,000
- DTE: ≤7 días / 14 / 21–45 + inputs min/max
- Botón grande **Próximo viernes**
- Lado: AUTO / CALLS / PUTS
- Símbolos vacíos = auto-scan large cap
- Comisión IBKR (texto): $0.65/contrato + ~$0.03 bolsa, mín. $1

El aviso rojo **“1–7 días agresivo”** usa **`dteMax` del filtro**, no el DTE del contrato abierto. Si pulsas 14 días, el aviso se apaga.

### Centro
- Tabla de contratos (símbolo, minichart+Bollinger, señal, score, strike, coste, spread, DTE, SÍ/MIRAR/NO)
- Al elegir fila: score, gráfica (velas, SMA 20/50/200, Bollinger, RSI, MACD)
- Cajas SMA/Bollinger: **MALO / BUENO** y cuánto % falta
- **¿Compro esto?** lenguaje claro + gráfica “hoy vs raya verde (break-even)” + cómo venía la prima
- Panel 1-2-3: Invertiste | Si llega la tesis | Promedio del modelo

### Derecha — métricas
- Técnico: RSI, SMA, Bollinger
- Dinero:
  - **Amarillo (`text-wait`)** = gasto (prima, comisión IBKR)
  - **Rojo** = pérdida
  - **Verde** = ganancia

### Mobile
Ticket pegajoso arriba. No copiar el layout desktop 1:1.

---

## 4. Cómo funciona por dentro

### Stack
TanStack Start · React · Tailwind · Recharts · server functions (`createServerFn`) · Vite en **8080**.

### Datos de mercado
`src/lib/yahoo.server.ts`

- Gráficas: Yahoo chart
- Cadenas: **Nasdaq option-chain** primero, Yahoo de respaldo
- **Nunca** usar vencimientos de < ~0.75 días (0-DTE muerto después del close)
- En rango 1–7 DTE junta **varios** vencimientos, no solo uno
- Si Nasdaq falla un símbolo, se omite y se loguea; el resto sigue

### Escaneo
`src/lib/market.fns.ts` → `scanBatch` (de a 3 símbolos)

Vacío de símbolos + opciones:

- Universo `SCAN_SYMBOLS` en `src/lib/scan.ts` (large caps / ETFs líquidos)
- Omite si volumen medio 20d < **1.5M**
- `pickLegs`: cabe en presupuesto **+ $1 de comisión**, strike **más cerca** del spot (no el más farol), spread razonable

Acciones/ETF: `scanEquities` + `STOCK_SYMBOLS` / `ETF_SYMBOLS` en `src/lib/equity.ts`.

### Score del contrato
`scoreContract` en `src/lib/scan.ts`

`liq + técnico + alineación de dirección + cercanía al dinero − penalización de spread`.

**Score alto ≠ cómpralo.** El score es setup del subyacente + liquidez. La decisión de compra es otra.

### Estimado
`src/lib/estimate.ts` → `estimatePayoff`

- Volatilidad: mezcla IV (si viene) + HV de log-returns
- Drift histórico recortado
- **Break-even** incluye comisión por acción
- `pProfit` = P(el spot cruce el BE) vía Black-Scholes / N(·)
- `expectedPnl` resta **ida y vuelta IBKR**
- `targetPnl` (“si llega la tesis”) resta **solo entrada** (vence)
- `maxLoss` = prima + comisión de abrir

### Comisión
`src/lib/fees.ts` — IBKR Pro Fixed EE.UU.

- Opciones: $0.65 + $0.03 · mín. $1/orden
- Acciones: $0.005/acción · mín. $1 · ida y vuelta

### ¿Compro esto? (SÍ / MIRAR / NO)
`src/lib/setup.ts` → `actionFor` + UI `src/components/plain-why.tsx`

Dos cosas distintas:

1. **La acción** (SMA/Bollinger) puede ir bien  
2. **El boleto** pide que el precio llegue al BE en N días  

Regla:

- **NO** si el salto > ~2× el movimiento típico, o P < 9%
- **SÍ** si el salto cabe en un día/periodo normal y el técnico va a favor
- **MIRAR** en el medio

Con **$25 y 2 días** casi todo es lotería. Eso es correcto, no un bug.  
Si no hay SÍ: subir presupuesto o días, no “suavizar” el modelo a lo loco.

### SMA / Bollinger
`src/components/price-chart.tsx`

- SMA: encima = bueno, debajo = malo. Decir **$ de la media** y **% que falta**.
- Bollinger: medio = bueno, pegado a una banda = estirado (malo).

---

## 5. Archivos que importan

```
src/routes/index.tsx          UI principal, scan, tabla, filtros
src/components/brand.tsx      APP_VERSION, logo RE, nombre
src/components/plain-why.tsx  “¿Compro esto?”
src/components/price-chart.tsx velas + SMA/BB + leyenda MALO/BUENO
src/components/estimate-panel.tsx  Invertiste / tesis / promedio
src/components/option-ticket.tsx   mobile
src/components/market-strip.tsx    índices
src/lib/yahoo.server.ts       fetch live
src/lib/market.fns.ts         scanBatch / pickLegs / índices
src/lib/scan.ts               universo, score, nextFriday, dte
src/lib/estimate.ts           P&L, BE, pProfit, backtest
src/lib/setup.ts              actionFor, tesis
src/lib/fees.ts               IBKR
src/lib/equity.ts             acciones/ETF
src/lib/analysis.ts           RSI, MACD, SMA, BB, sparkline
PROJECT.md                    este archivo
VERSION                       WEB5.0 - V3.24
```

**No hay `index.html` en la raíz.** Si aparece, es basura v1.0: bórralo.

---

## 6. GitHub — bajar (Mac)

Repo **público**. Tag = versión.

```bash
DEST="/Users/robertoescobar/Library/Mobile Documents/com~apple~CloudDocs/__DATA/_AI_Grok/opciones_analizador_WEB5.0"
mkdir -p "$DEST"
rm -rf /tmp/pulso-opciones
git clone --branch v3.24 --depth 1 https://github.com/Roberto6669/pulso-opciones.git /tmp/pulso-opciones
cp -R /tmp/pulso-opciones/. "$DEST"
rm -f "$DEST/index.html"
grep APP_VERSION "$DEST/src/components/brand.tsx"
```

Debe decir `WEB5.0 - V3.24`.

`cp -R` **no borra** archivos viejos. Por eso el `rm -f index.html`.

No uses `curl` zip si el repo vuelve a ser privado (baja 9 bytes = `Not Found`).

Luego **rebuild Docker**. Copiar archivos no cambia el contenedor que ya corre.

---

## 7. GitHub — subir (agente en Grok)

Desde el sandbox, el flujo que ya funciona:

1. Clonar `Roberto6669/pulso-opciones` a `/tmp/pulso-push` (si no está).
2. Copiar `/workspace/src` → repo.
3. Actualizar `VERSION` y `APP_VERSION`.
4. **No** commitear un `index.html` estático v1.0.
5. `git commit` + `git tag -f vX.Y` + `git push origin main` + `git push origin vX.Y`
6. `gh release create`

Cuenta GitHub: **Roberto6669**.

---

## 8. Hosting Mac Mini (reglas de Roberto)

Leer siempre su `CLAUDE.md` + `ports.json` (fuente de puertos).

- Cada proyecto = **su Docker**, independiente
- WEB4.0 (`opciones-w4`, puerto 10101) **no se apaga**
- WEB5.0 necesita **puerto nuevo** (no 10101). Elegir de `free_suggested` en `ports.json` y registrarlo
- Tailscale: hostname propio tipo `opciones-w5.tailac6c74.ts.net`
- launchd / compose como el resto; **no** `tailscale funnel` suelto
- Docker lo arma Claude (conoce las reglas). Grok programa el analizador.

Prompt actual de Terminal: a veces está en `opciones-w5` — esa carpeta Docker no es el DEST de iCloud.

---

## 9. Marca y UX (no romper)

- Header como WEB4: monograma **RE**, nombre completo, versión
- Oscuro, terminal, **sin esquinas redondas** grandes / look infantil
- Montos a **2 decimales**
- Español claro. Evitar jerga sin traducir (subyacente → la acción; contrato → boleto)
- Separar siempre: **la acción va bien** ≠ **compra este weekly**
- iPhone: más info arriba, menos scroll

---

## 10. Errores que ya cometimos (no repetir)

| Síntoma | Causa real | Arreglo |
|---|---|---|
| GitHub “baja v1.0” | `index.html` prototipo en la raíz | Borrarlo. El app es `src/` |
| `curl` zip = 9 bytes | Repo privado | `git clone` autenticado, o repo público |
| Carpeta DEST vacía | `rm -rf "$DEST"` | Clonar a `/tmp` y `cp -R` |
| Sigue v1.0 tras copiar | `cp` no borra leftover + Docker viejo | `rm index.html` + rebuild |
| Cero resultados | Escaneo agarraba 0-DTE muerto | Ignorar < 0.75 días; varios vencimientos 1–7 |
| Todo NO | $25 + 2 DTE es lotería + filtro duro | Strikes más cerca; SÍ si el salto cabe en 1σ |
| 14 días no quita el rojo | Aviso usaba DTE del contrato, no el filtro | Usar `dteMax` |
| EVITAR con SMA verde | Se mezclaba técnico y boleto | Dos cajas: acción vs boleto |
| P&L de $19 → $45,000 | Estimado fantasioso | BS + HV + tesis ≠ promedio |
| Mini BB invisible | `every()` con nulls | Filtrar puntos con bandas |
| Descarga al iCloud | Downloads vacío, `#` rompe zsh | git clone, sin comentarios `#` |

---

## 11. Cómo retomar en un año (Grok Project)

1. Crear Project **Pulso WEB5.0**.
2. Adjuntar **este `PROJECT.md`** y, si cabe, clonar el repo.
3. Pegar el prompt de la sección 12.
4. Confirmar `APP_VERSION` en GitHub vs `brand.tsx`.
5. Desarrollar en Grok (preview 8080).
6. Tag nuevo, bajar al DEST, rebuild Docker. WEB4 no se toca.

Si el sandbox de Grok está vacío: clonar `https://github.com/Roberto6669/pulso-opciones` a `/workspace` y `npm install && npm run dev` en 8080.

---

## 12. Prompt para el Project (copiar y pegar)

```
Eres Grok Build. Este Project es Pulso Options Analyzer (WEB5.0).

Lee primero PROJECT.md (biblia). Código en GitHub:
https://github.com/Roberto6669/pulso-opciones  (main, última tag = versión).

Dueño: Roberto Escobar Citty. Mac Mini M1: Docker + Tailscale. WEB4.0
(opciones-w4) sigue vivo; WEB5 es independiente. Disco:
/Users/robertoescobar/Library/Mobile Documents/com~apple~CloudDocs/__DATA/_AI_Grok/opciones_analizador_WEB5.0

Qué es: escáner de opciones (default) / acciones / ETF por presupuesto y DTE.
Datos Nasdaq+Yahoo. Comisión IBKR. No es consejo ni broker.

Reglas de producto:
- APP_VERSION en src/components/brand.tsx en cada cambio visible (WEB5.0 - Vx.y)
- Header RE + ROBERTO ESCOBAR CITTY + versión
- Español claro. Acción ≠ boleto. Amarillo=gasto, rojo=pérdida, verde=ganancia
- Weeklies $25 casi nunca son SÍ; no falsees el modelo
- No crear index.html estático. No apagar WEB4. Push a GitHub con tag
- Preview del sandbox en 0.0.0.0:8080

Al retomar: git pull, lee PROJECT.md, no reescribas el app desde cero.
```
