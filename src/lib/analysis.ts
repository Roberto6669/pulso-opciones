export type SignalKind = "comprar" | "esperar" | "vender";

export type Bar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type Indicators = {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bbMid: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  atr14: number | null;
  volAvg20: number | null;
};

export type Reason = {
  title: string;
  detail: string;
  weight: number;
};

export type Verdict = {
  kind: SignalKind;
  score: number;
  headline: string;
  reasons: Reason[];
};

function lastValid(series: Array<number | null>): number | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i] ?? 0;
    if (i >= period) sum -= values[i - period] ?? 0;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (prev == null) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
      prev = sum / period;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function atr(bars: Bar[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(bars.length).fill(null);
  if (bars.length < 2) return out;
  const trs: number[] = [0];
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1].c;
    const b = bars[i];
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev)));
  }
  return sma(trs, period);
}

export function computeIndicators(bars: Bar[]): Indicators {
  const closes = bars.map((b) => b.c);
  const vols = bars.map((b) => b.v);
  const sma20s = sma(closes, 20);
  const sma50s = sma(closes, 50);
  const sma200s = sma(closes, 200);
  const rsis = rsi(closes, 14);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_, i) => {
    const a = ema12[i];
    const b = ema26[i];
    return a != null && b != null ? a - b : null;
  });
  const macdFilled = macdLine.map((v, i) =>
    v == null ? lastValid(macdLine.slice(0, i + 1)) ?? 0 : v,
  );
  const signalLine = ema(macdFilled, 9);
  const std20 = stdev(closes, 20);
  const atrs = atr(bars, 14);
  const volAvgs = sma(vols, 20);
  const mid = lastValid(sma20s);
  const sd = lastValid(std20);
  return {
    sma20: lastValid(sma20s),
    sma50: lastValid(sma50s),
    sma200: lastValid(sma200s),
    rsi14: lastValid(rsis),
    macd: lastValid(macdLine),
    macdSignal: lastValid(signalLine),
    macdHist:
      lastValid(macdLine) != null && lastValid(signalLine) != null
        ? (lastValid(macdLine) as number) - (lastValid(signalLine) as number)
        : null,
    bbMid: mid,
    bbUpper: mid != null && sd != null ? mid + 2 * sd : null,
    bbLower: mid != null && sd != null ? mid - 2 * sd : null,
    atr14: lastValid(atrs),
    volAvg20: lastValid(volAvgs),
  };
}

function stdev(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const v = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(v);
  }
  return out;
}

export function judge(price: number, bars: Bar[], ind: Indicators): Verdict {
  const reasons: Reason[] = [];
  let score = 50;
  const prev = bars.length >= 2 ? bars[bars.length - 2].c : price;
  const dayChg = prev ? ((price - prev) / prev) * 100 : 0;
  const lastVol = bars.at(-1)?.v ?? 0;

  if (ind.sma50 != null && ind.sma200 != null) {
    if (ind.sma50 > ind.sma200 && price > ind.sma50) {
      score += 16;
      reasons.push({
        title: "Tendencia alcista",
        detail: "Precio sobre la media de 50, y la 50 sobre la 200 (estructura alcista).",
        weight: 16,
      });
    } else if (ind.sma50 < ind.sma200 && price < ind.sma50) {
      score -= 16;
      reasons.push({
        title: "Tendencia bajista",
        detail: "Precio bajo la media de 50, y la 50 bajo la 200.",
        weight: -16,
      });
    } else {
      reasons.push({
        title: "Tendencia mixta",
        detail: "Las medias no se alinean. El mercado no tiene un sesgo claro.",
        weight: 0,
      });
    }
  }

  if (ind.sma20 != null) {
    if (price > ind.sma20) {
      score += 6;
      reasons.push({
        title: "Sobre la media 20",
        detail: "El corto plazo acompaña.",
        weight: 6,
      });
    } else {
      score -= 6;
      reasons.push({
        title: "Bajo la media 20",
        detail: "El corto plazo presiona a la baja.",
        weight: -6,
      });
    }
  }

  if (ind.rsi14 != null) {
    if (ind.rsi14 <= 30) {
      score += 12;
      reasons.push({
        title: "RSI sobreventa",
        detail: `RSI ${ind.rsi14.toFixed(1)}. Zona donde suelen aparecer rebotes, no una garantía.`,
        weight: 12,
      });
    } else if (ind.rsi14 >= 70) {
      score -= 12;
      reasons.push({
        title: "RSI sobrecompra",
        detail: `RSI ${ind.rsi14.toFixed(1)}. El movimiento al alza está extendido.`,
        weight: -12,
      });
    } else if (ind.rsi14 >= 52 && ind.rsi14 < 70) {
      score += 6;
      reasons.push({
        title: "RSI con momentum",
        detail: `RSI ${ind.rsi14.toFixed(1)}, por encima de 50 sin estar extremo.`,
        weight: 6,
      });
    } else if (ind.rsi14 <= 48) {
      score -= 4;
      reasons.push({
        title: "RSI flojo",
        detail: `RSI ${ind.rsi14.toFixed(1)}, por debajo de 50.`,
        weight: -4,
      });
    }
  }

  if (ind.macdHist != null) {
    if (ind.macdHist > 0) {
      score += 10;
      reasons.push({
        title: "MACD positivo",
        detail: "El histograma está a favor de los compradores.",
        weight: 10,
      });
    } else {
      score -= 10;
      reasons.push({
        title: "MACD negativo",
        detail: "El histograma está a favor de los vendedores.",
        weight: -10,
      });
    }
  }

  if (ind.bbLower != null && ind.bbUpper != null && ind.bbMid != null) {
    const width = ind.bbUpper - ind.bbLower;
    if (width > 0) {
      const pos = (price - ind.bbLower) / width;
      if (pos <= 0.12) {
        score += 8;
        reasons.push({
          title: "Cerca de la banda inferior",
          detail: "Precio en la zona baja de Bollinger. Posible estiramiento a la baja.",
          weight: 8,
        });
      } else if (pos >= 0.88) {
        score -= 8;
        reasons.push({
          title: "Cerca de la banda superior",
          detail: "Precio en la zona alta de Bollinger. El alza está estirada.",
          weight: -8,
        });
      }
    }
  }

  if (ind.volAvg20 && lastVol > ind.volAvg20 * 1.4) {
    if (dayChg > 0) {
      score += 6;
      reasons.push({
        title: "Volumen confirma la subida",
        detail: "El volumen de hoy supera claramente su media de 20 días.",
        weight: 6,
      });
    } else if (dayChg < 0) {
      score -= 6;
      reasons.push({
        title: "Volumen confirma la caída",
        detail: "Se vende con más volumen del habitual.",
        weight: -6,
      });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let kind: SignalKind = "esperar";
  if (score >= 66) kind = "comprar";
  else if (score <= 38) kind = "vender";

  const headline =
    kind === "comprar"
      ? "La estructura favorece comprar con riesgo definido."
      : kind === "vender"
        ? "La estructura favorece no perseguir, o reducir."
        : "No hay ventaja técnica clara. Mejor esperar.";

  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { kind, score, headline, reasons: reasons.slice(0, 5) };
}

export function chartSeries(bars: Bar[]) {
  const closes = bars.map((b) => b.c);
  const sma20s = sma(closes, 20);
  const sma50s = sma(closes, 50);
  const sma200s = sma(closes, 200);
  const stds = stdev(closes, 20);
  const rsis = rsi(closes, 14);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_, i) => {
    const a = ema12[i];
    const b = ema26[i];
    return a != null && b != null ? a - b : null;
  });
  const macdFilled = macdLine.map((v, i) =>
    v == null ? lastValid(macdLine.slice(0, i + 1)) ?? 0 : v,
  );
  const signalLine = ema(macdFilled, 9);

  return bars.map((b, i) => {
    const mid = sma20s[i];
    const sd = stds[i];
    const macd = macdLine[i];
    const signal = signalLine[i];
    return {
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
      sma20: sma20s[i],
      sma50: sma50s[i],
      sma200: sma200s[i],
      mid,
      upper: mid != null && sd != null ? mid + 2 * sd : null,
      lower: mid != null && sd != null ? mid - 2 * sd : null,
      rsi: rsis[i],
      macd,
      signal,
      hist: macd != null && signal != null ? macd - signal : null,
      up: i === 0 ? true : b.c >= bars[i - 1].c,
    };
  });
}
