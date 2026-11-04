import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button, Text, Toggle } from "@/components";
import { RipplePressable } from "@/components/ui/ripple-pressable/RipplePressable";
import {
  getAllLlms,
  getLlmInfo,
  getRecommendedLlmId,
  type LlmModelId,
} from "@/models";
import { llmService, summarize, type LlmTask } from "@/services";
import { useModelDownloadStore } from "@/stores";
import { useTheme } from "@/theme";
import { formatBytes } from "@/utils";

// Same fixtures and scoring as `npm run bench:llm`, so device and desktop
// numbers line up.
import fixtures from "../../scripts/llm-summary/fixtures.json";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scoreOutput } = require("../../scripts/llm-summary/score");

const TASKS: LlmTask[] = ["summary", "cleanup"];
const CONTEXT_SIZES = [8192, 16384, 32768];
const LONG_SESSION_TOKENS = 20_000;
const ALL_TRANSCRIPTS = fixtures.map((f) => f.transcript).join("\n\n");

interface Row {
  task: LlmTask;
  fixture: string;
  score: number;
  missing: string[];
  tokensPerSecond: number;
  promptTokensPerSecond: number;
  seconds: number;
  text: string;
}

const mean = (xs: number[]) =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export default function LlmBenchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const downloaded = useModelDownloadStore((s) => s.downloadedModels);
  const models = getAllLlms().filter((m) => downloaded.has(m.id));

  const [ram, setRam] = useState<number | null>(null);
  const [modelId, setModelId] = useState<LlmModelId | null>(null);
  const [gpu, setGpu] = useState(true);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    llmService
      .getTotalRamBytes()
      .then(setRam)
      .catch((e) => setStatus(`RAM: ${String(e)}`));
  }, []);

  const selected = modelId ?? models[0]?.id ?? null;

  const run = async () => {
    if (!selected) return;
    setRunning(true);
    setRows([]);
    const done: Row[] = [];
    try {
      setStatus("Loading…");
      const loadMs = await llmService.load(selected, { gpu });
      for (const task of TASKS) {
        for (const fixture of fixtures) {
          setStatus(`${task} · ${fixture.id}`);
          const started = Date.now();
          const out = await llmService.run(selected, task, fixture.transcript, {
            gpu,
          });
          const score = scoreOutput(task, fixture, out.text);
          done.push({
            task,
            fixture: fixture.id,
            score: score.total,
            missing: score.missing,
            tokensPerSecond: out.tokensPerSecond,
            promptTokensPerSecond: out.promptTokensPerSecond,
            seconds: (Date.now() - started) / 1000,
            text: out.text,
          });
          setRows([...done]);
        }
      }
      const summary = TASKS.map(
        (t) =>
          `${t} ${Math.round(mean(done.filter((r) => r.task === t).map((r) => r.score)))}`,
      ).join(" · ");
      setStatus(
        `Done · load ${(loadMs / 1000).toFixed(1)}s · ${summary} · ` +
          `${Math.round(mean(done.map((r) => r.tokensPerSecond)))} tok/s`,
      );
      // Copy from the Metro log to compare devices.
      console.log(
        "[llm-bench]",
        JSON.stringify({ model: selected, gpu, ram, loadMs, rows: done }),
      );
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    } finally {
      await llmService.release();
      setRunning(false);
    }
  };

  /** ~`tokens` of transcript text: the fixtures repeated, cut to size. */
  const syntheticTranscript = async (id: LlmModelId, tokens: number) => {
    const perCopy = await llmService.countTokens(id, ALL_TRANSCRIPTS, { gpu });
    const copies = ALL_TRANSCRIPTS.repeat(Math.ceil(tokens / perCopy) + 1);
    const chars = Math.floor((ALL_TRANSCRIPTS.length * tokens) / perCopy);
    return copies.slice(0, chars);
  };

  // One full-context summary per size; logs before each step so the last
  // "start" line in Metro names the size that got the app killed.
  const contextTest = async () => {
    if (!selected) return;
    setRunning(true);
    setRows([]);
    const results: object[] = [];
    try {
      for (const contextTokens of CONTEXT_SIZES) {
        setStatus(`ctx ${contextTokens} · loading…`);
        console.log("[llm-bench] ctx start", contextTokens);
        const loadMs = await llmService.load(selected, { gpu, contextTokens });
        const input = await syntheticTranscript(
          selected,
          llmService.inputBudget(selected, contextTokens),
        );
        setStatus(`ctx ${contextTokens} · summarizing…`);
        const started = Date.now();
        const out = await llmService.run(selected, "summary", input, {
          gpu,
          contextTokens,
        });
        const result = {
          contextTokens,
          loadMs,
          promptTokens: out.promptTokens,
          promptTokensPerSecond: Math.round(out.promptTokensPerSecond),
          tokensPerSecond: Math.round(out.tokensPerSecond),
          seconds: (Date.now() - started) / 1000,
        };
        results.push(result);
        console.log("[llm-bench] ctx ok", JSON.stringify(result));
        setStatus(
          results
            .map((r) => JSON.stringify(r))
            .join("\n")
            .replace(/[{}"]/g, ""),
        );
      }
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    } finally {
      await llmService.release();
      setRunning(false);
    }
  };

  // The app's real path: a session too long for one pass, map-reduced.
  const longSessionTest = async () => {
    if (!selected) return;
    setRunning(true);
    setRows([]);
    try {
      const input = await syntheticTranscript(selected, LONG_SESSION_TOKENS);
      const started = Date.now();
      const text = await summarize(input, {
        budget: llmService.inputBudget(selected),
        finalBudget: llmService.finalInputBudget(selected),
        finalOutputTokens: (tokens) =>
          llmService.finalOutputTokens(selected, tokens),
        countTokens: (t) => llmService.countTokens(selected, t, { gpu }),
        complete: async (task, t, options) =>
          (await llmService.run(selected, task, t, { gpu, ...options })).text,
        isCancelled: () => false,
        onProgress: (part, parts) => setStatus(`Part ${part} of ${parts}…`),
        onText: (partial) => setStatus(partial),
      });
      const seconds = (Date.now() - started) / 1000;
      console.log(
        "[llm-bench] long session",
        JSON.stringify({ model: selected, gpu, seconds, text }),
      );
      setStatus(`Done in ${seconds.toFixed(0)}s\n\n${text}`);
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    } finally {
      await llmService.release();
      setRunning(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "LLM Bench",
          headerShown: true,
          headerStyle: { backgroundColor: c.surfaceBackground },
          headerTintColor: c.textPrimary,
        }}
      />
      <ScrollView
        style={{ backgroundColor: c.surfaceBackground }}
        contentContainerStyle={styles.container}
      >
        <Text variant="body2" color={c.textSecondary}>
          RAM {ram ? formatBytes(ram) : "…"} · recommended{" "}
          {ram ? getLlmInfo(getRecommendedLlmId(ram)).name : "…"}
        </Text>

        {models.length === 0 && (
          <Text variant="body2" color={c.accentWarning}>
            Download a model in Settings → Intelligence first.
          </Text>
        )}
        {models.map((m) => (
          <RipplePressable
            key={m.id}
            onPress={() => setModelId(m.id)}
            style={[
              styles.option,
              {
                borderColor:
                  m.id === selected
                    ? c.surfaceBorderSelected
                    : c.surfaceBorderPrimary,
              },
            ]}
          >
            <Text variant="body1" color={c.textPrimary}>
              {m.name}
            </Text>
          </RipplePressable>
        ))}

        <View style={styles.row}>
          <Text variant="body1" color={c.textPrimary}>
            GPU offload
          </Text>
          <Toggle value={gpu} onValueChange={setGpu} enabled={!running} />
        </View>

        <Button.primary
          text="Run Bench"
          onPress={run}
          isLoading={running}
          enabled={!!selected && !running}
        />
        <Button.secondary
          text="Context Test (8k / 16k / 32k)"
          onPress={contextTest}
          enabled={!!selected && !running}
        />
        <Button.secondary
          text="Long Session Test (20k Tokens)"
          onPress={longSessionTest}
          enabled={!!selected && !running}
        />
        <Text variant="body2" color={c.textSecondary}>
          {status}
        </Text>

        {rows.map((r) => (
          <View
            key={`${r.task}-${r.fixture}`}
            style={[styles.result, { borderColor: c.surfaceBorderPrimary }]}
          >
            <Text variant="body2" weight="semibold" color={c.textPrimary}>
              {r.task} · {r.fixture} · {r.score} ·{" "}
              {Math.round(r.tokensPerSecond)} tok/s ·{" "}
              {Math.round(r.promptTokensPerSecond)} pp/s ·{" "}
              {r.seconds.toFixed(1)}s
            </Text>
            {r.missing.length > 0 && (
              <Text variant="caption1" color={c.accentWarning}>
                missing: {r.missing.join(", ")}
              </Text>
            )}
            <Text variant="caption1" color={c.textSecondary} numberOfLines={6}>
              {r.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  option: { borderWidth: 1, borderRadius: 12, padding: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  result: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
});
