"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Speech-to-text for the composer mic button, built on the browser Web Speech
// API (SpeechRecognition / webkitSpeechRecognition — Chrome, Edge, Safari).
//
// Usage:
//   const voice = useDictation(setValue, () => value,
//                              locale === "ar" ? "ar-SA" : "en-US",
//                              () => toast.error(s.voiceUnsupported));
//   <button data-on={voice.listening} onClick={voice.toggle} ... />
//
// `setText` writes the textarea; `getText` reads its current value. While
// listening we rebuild the value as: <text that was there when you tapped> +
// <finalized speech> + <live interim> so dictation appends to whatever was
// already typed and updates in real time. Taking a plain string setter (not a
// functional updater) keeps it compatible with both React useState and the
// custom draft store.

type SetText = (next: string) => void;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getSR(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useDictation(setText: SetText, getText: () => string, lang: string, onUnsupported?: () => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");   // text already in the box when recognition started

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  // Keep lang fresh for an in-flight session (e.g. user flips EN/AR).
  useEffect(() => {
    if (recRef.current) recRef.current.lang = lang;
  }, [lang]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
  }, []);

  // Stop on unmount so the mic is released when leaving the page.
  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const toggle = useCallback(() => {
    const SR = getSR();
    if (!SR) { onUnsupported?.(); return; }
    if (recRef.current) { stop(); return; }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    // Capture the current textarea contents as the base to append onto.
    const p = getText() ?? "";
    baseRef.current = p.trim() ? p.replace(/\s*$/, "") + " " : "";

    // `e.results` is the FULL cumulative list for the session (interim + final),
    // so we rebuild the whole transcript from scratch every event and write
    // base + transcript. This is idempotent — unlike a `+=` accumulator, which
    // re-adds a result each time the event re-fires after it goes final and
    // produced the "whatwhatwhat" / "عايزكعايزك" duplication.
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setText(baseRef.current + transcript);
    };
    rec.onerror = () => { /* onend always follows; just let it reset */ };
    rec.onend = () => { recRef.current = null; setListening(false); };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [lang, setText, getText, stop, onUnsupported]);

  return { supported, listening, toggle, stop };
}
