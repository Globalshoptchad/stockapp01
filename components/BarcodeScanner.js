"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import { useLang } from "./Providers";

export function scannerSupported() {
  return (
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  );
}

// Lit les vrais codes-barres avec la caméra (gratuit, intégré à Chrome sur Android, pas d'IA).
export default function BarcodeScanner({ onDetected, onClose }) {
  const { t } = useLang();
  const videoRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream = null;
    let timer = null;
    let stopped = false;

    async function start() {
      if (!scannerSupported()) {
        setError(t("scan_unsupported"));
        return;
      }
      try {
        const wanted = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
        let formats = wanted;
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          formats = wanted.filter((f) => supported.includes(f));
        } catch {}
        const detector = new window.BarcodeDetector(formats.length ? { formats } : undefined);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes && codes.length) {
              stopped = true;
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {}
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (err) {
        setError(t("camera_denied"));
      }
    }

    start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      <div className="scanner-frame" />
      <div className="scanner-msg">{error || t("scanning")}</div>
      <button type="button" className="scanner-close" onClick={onClose} aria-label={t("cancel")}>
        <Icon name="x" size={28} />
      </button>
    </div>
  );
}
