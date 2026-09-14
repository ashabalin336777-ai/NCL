"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError, transcribeSpeech } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => Promise<void> | void;
}

function isOperaBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /OPR\/|Opera/i.test(navigator.userAgent);
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((item) => MediaRecorder.isTypeSupported(item));
}

function extensionForMime(mime: string): string {
  if (mime.includes("ogg")) {
    return "ogg";
  }
  if (mime.includes("mp4") || mime.includes("m4a")) {
    return "m4a";
  }
  return "webm";
}

export function ChatComposer({ disabled, sending, onSend }: ChatComposerProps): React.JSX.Element {
  const [text, setText] = useState("");
  const [liveLine, setLiveLine] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [secureContext, setSecureContext] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [engine, setEngine] = useState<"neuraldeep" | "none">("neuraldeep");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    setSecureContext(window.isSecureContext);
    setEngine(typeof MediaRecorder !== "undefined" ? "neuraldeep" : "none");
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const canSend = useMemo(
    () => text.trim().length > 0 && !disabled && !sending && !listening && !transcribing,
    [text, disabled, sending, listening, transcribing],
  );

  function clearRecordingResources(): void {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setElapsedSec(0);
  }

  async function finishRecordingAndTranscribe(): Promise<void> {
    const recorder = recorderRef.current;
    const mime = recorder?.mimeType || pickRecorderMime() || "audio/webm";
    const ext = extensionForMime(mime);

    const blob: Blob = await new Promise((resolve, reject) => {
      if (!recorder) {
        resolve(new Blob());
        return;
      }
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mime }));
      };
      recorder.onerror = () => reject(new Error("Ошибка остановки записи"));
      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          resolve(new Blob(chunksRef.current, { type: mime }));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Не удалось остановить запись"));
      }
    });

    clearRecordingResources();
    setListening(false);

    if (blob.size < 1200) {
      setVoiceError("Слишком короткая запись. Зажмите микрофон и говорите дольше.");
      setLiveLine("");
      setVoiceHint(null);
      return;
    }

    setTranscribing(true);
    setLiveLine("Распознаю всю фразу…");
    setVoiceHint("Голосовой ввод");
    try {
      const recognized = await transcribeSpeech(blob, `speech.${ext}`);
      if (!recognized) {
        setVoiceError("Не расслышали речь. Повторите запись.");
        setLiveLine("");
        return;
      }
      const spacer = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : "";
      baseTextRef.current = `${baseTextRef.current}${spacer}${recognized}`.trimStart();
      setText(baseTextRef.current);
      setLiveLine(recognized);
      setVoiceError(null);
      setVoiceHint("Готово — можно отправить или дописать");
    } catch (error) {
      setVoiceError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Ошибка распознавания",
      );
      setLiveLine("");
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleVoice(): Promise<void> {
    if (listening) {
      setVoiceHint("Останавливаю запись…");
      await finishRecordingAndTranscribe();
      return;
    }
    if (transcribing) {
      return;
    }

    setVoiceError(null);
    setLiveLine("");
    setVoiceHint(null);

    if (engine === "none") {
      setVoiceError("Браузер не умеет записывать аудио (MediaRecorder).");
      return;
    }
    if (!window.isSecureContext) {
      setVoiceError("Откройте http://localhost:8080 — иначе браузер блокирует микрофон.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Нет доступа к микрофону. Разрешите его для сайта.");
      return;
    }

    setVoiceHint("Запрашиваем микрофон…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      baseTextRef.current = text.trim();
      setListening(true);
      setElapsedSec(0);
      setLiveLine("Слушаю… говорите всю фразу, затем нажмите «Стоп»");
      setVoiceHint(isOperaBrowser() ? "Opera · запись целиком" : "Запись целиком");
      timerRef.current = window.setInterval(() => {
        setElapsedSec((value) => value + 1);
      }, 1000);
    } catch (err) {
      clearRecordingResources();
      setListening(false);
      setVoiceError(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
          ? "Микрофон запрещён. Разрешите его для сайта в настройках браузера."
          : err instanceof Error
            ? err.message
            : "Не удалось получить микрофон",
      );
      setVoiceHint(null);
    }
  }

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (listening || transcribing) {
      return;
    }
    const value = (baseTextRef.current || text).trim();
    if (!value || disabled || sending) {
      return;
    }
    setText("");
    baseTextRef.current = "";
    setLiveLine("");
    setVoiceHint(null);
    try {
      await onSend(value);
    } catch {
      setText(value);
      baseTextRef.current = value;
    }
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-3" onSubmit={(e) => void submit(e)}>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (!listening) {
            baseTextRef.current = event.target.value;
          }
        }}
        disabled={disabled || sending || listening || transcribing}
        rows={3}
        placeholder="Ваша реплика менеджеру… Цель — следующий шаг: BOM, встреча, NDA."
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
      />

      {listening || transcribing || liveLine ? (
        <div className="mt-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-accent">
            <span className="relative flex h-2.5 w-2.5">
              {listening ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              ) : null}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            {listening ? `Идёт запись · ${elapsedSec} с` : null}
            {transcribing ? "Распознавание…" : null}
            {!listening && !transcribing && liveLine ? "Распознано" : null}
            {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {voiceHint ? <span className="font-normal text-slate-500">· {voiceHint}</span> : null}
          </div>
          <p className="mt-1 min-h-6 text-sm leading-6 text-slate-700">
            {liveLine ? (
              <>
                <span className={cn("font-medium text-navy", listening && "animate-pulse")}>
                  {liveLine}
                </span>
                {listening || transcribing ? (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-navy align-middle" />
                ) : null}
              </>
            ) : (
              <span className="italic text-slate-400">
                Говорите целиком, затем «Стоп» — текст появится здесь
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400 align-middle" />
              </span>
            )}
          </p>
        </div>
      ) : null}

      {voiceError ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{voiceError}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant={listening ? "accent" : "outline"}
          disabled={!secureContext || disabled || sending || engine === "none" || transcribing}
          onClick={() => void toggleVoice()}
          title="Запись всей фразы, затем распознавание речи"
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {listening ? "Стоп" : transcribing ? "Распознаю…" : "Микрофон"}
        </Button>
        <Button type="submit" disabled={!canSend} className={cn(!canSend && "opacity-60")}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          Отправить
        </Button>
      </div>
    </form>
  );
}
