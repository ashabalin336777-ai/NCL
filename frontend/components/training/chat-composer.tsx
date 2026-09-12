"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => Promise<void> | void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") {
    return null;
  }
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function ChatComposer({ disabled, sending, onSend }: ChatComposerProps): React.JSX.Element {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const canSend = useMemo(
    () => text.trim().length > 0 && !disabled && !sending,
    [text, disabled, sending],
  );

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const value = text.trim();
    if (!value || disabled || sending) {
      return;
    }
    setText("");
    await onSend(value);
  }

  function toggleVoice(): void {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const chunks: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        chunks.push(event.results[i][0]?.transcript ?? "");
      }
      setText(chunks.join(" ").trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-3" onSubmit={(e) => void submit(e)}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled || sending}
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant={listening ? "accent" : "outline"}
          disabled={!speechSupported || disabled || sending}
          onClick={toggleVoice}
          title={speechSupported ? "Голосовой ввод" : "Web Speech API недоступен в этом браузере"}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {listening ? "Стоп" : "Микрофон"}
        </Button>
        <Button type="submit" disabled={!canSend} className={cn(!canSend && "opacity-60")}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          Отправить
        </Button>
      </div>
    </form>
  );
}
