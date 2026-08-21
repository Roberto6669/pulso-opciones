import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceChart } from "@/components/price-chart";
import { EstimatePanel } from "@/components/estimate-panel";
import { MiniChart } from "@/components/mini-chart";
import { PlainWhy } from "@/components/plain-why";
import { OptionTicket } from "@/components/option-ticket";
import { EquityTicket } from "@/components/equity-ticket";
import { ScoreBar, MiniScore } from "@/components/score-bar";
import { OptionsCalculator } from "@/components/options-calculator";
import { APP_VERSION } from "@/components/brand";
import { analyzeTicker, fetchHotUniverse, scanBatch, scanEquities, type PublicAnalysis } from "@/lib/market.fns";
import type { SparkPoint } from "@/lib/analysis";
import { estimatePayoff } from "@/lib/estimate";
import { actionFor, confidenceLabel, dteRisk, setupTags } from "@/lib/setup";
import { cn, formatMoney, formatPct } from "@/lib/utils";
import {
  ETF_SYMBOLS,
  STOCK_SYMBOLS,
  estimateEquity,
  type EquityHit,
  type MarketMode,
} from "@/lib/equity";
import {
  dte,
  iso,
  nextFriday,
  parseSymbols,
  SCAN_SYMBOLS,
  type Ranked,
  type Side,
} from "@/lib/scan";
