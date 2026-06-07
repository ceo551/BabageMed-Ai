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
// IMPORTANT cross-browser note: we run each recognition with continuous=false
// (ONE utterance per session) and auto-restart on `onend` while the user is
// still listening. continuous=true is unusable on Android Chrome — it re-emits
// the whole growing transcript as OVERLAPPING results every event, which made
// dictation pile up ("whatwhatwhat I…" / "عايزكعايزك تروح…"). With one clean
// utterance per session we only ever commit each finalized phrase once.

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
  const wantRef = useRef(false);  // does the user still want to be dictating?
  const baseRef = useRef("");     // text already committed (typed + finalized speech) + trailing space
  const langRef = useRef(lang);

  useEffect(() => { setSupported(!!getSR()); }, []);
  useEffect(() => { langRef.current = lang; if (recRef.current) recRef.current.lang = lang; }, [lang]);

  // Read setText/getText/onUnsupported through refs so the recognition callbacks
  // (which outlive a render) always use the latest closures without re-binding.
  const setTextRef = useRef(setText); setTextRef.current = setText;
  const getTextRef = useRef(getText); getTextRef.current = getText;
  const onUnsupportedRef = useRef(onUnsupported); onUnsupportedRef.current = onUnsupported;

  const startSession = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    const rec = new SR();
    rec.lang = langRef.current;
    rec.continuous = false;     // one utterance per session (see note above)
    rec.interimResults = true;

    let uttFinal = "";          // finalized transcript for THIS utterance

    rec.onresult = (e: any) => {
      // Within a non-continuous session there is a single growing result; read
      // the last one only (never concatenate the whole list — that's the
      // mobile duplication trap).
      const last = e.results[e.results.length - 1];
      const txt = last[0].transcript as string;
      if (last.isFinal) uttFinal = txt;
      setTextRef.current(baseRef.current + txt);
    };

    rec.onerror = (ev: any) => {
      // no-speech / aborted are normal (onend will restart). Hard failures stop.
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed" || ev?.error === "audio-capture") {
        wantRef.current = false;
        onUnsupportedRef.current?.();
      }
    };

    rec.onend = () => {
      // Commit this utterance's finalized text into the base, then restart for
      // the next utterance if the user hasn't tapped stop.
      if (uttFinal.trim()) {
        baseRef.current = (baseRef.current + uttFinal).replace(/\s+$/, "") + " ";
      }
      recRef.current = null;
      if (wantRef.current) {
        startSession();
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      wantRef.current = false;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
  }, []);

  // Release the mic on unmount.
  useEffect(() => () => { wantRef.current = false; try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const toggle = useCallback(() => {
    if (!getSR()) { onUnsupportedRef.current?.(); return; }
    if (recRef.current || wantRef.current) { stop(); return; }
    // Capture whatever is already typed as the base to append onto.
    const p = getTextRef.current() ?? "";
    baseRef.current = p.trim() ? p.replace(/\s+$/, "") + " " : "";
    wantRef.current = true;
    startSession();
  }, [startSession, stop]);

  return { supported, listening, toggle, stop };
}
