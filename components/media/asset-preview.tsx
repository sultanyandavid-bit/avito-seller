"use client";
/* eslint-disable @next/next/no-img-element -- Local IndexedDB blob URLs cannot use server image optimization. */
import { useEffect, useState } from "react";
import { getAsset } from "@/lib/media/assets";
import type { Asset } from "@/lib/media/types";
export default function AssetPreview({
  storeId,
  id,
  download = false,
  label,
}: {
  storeId: string;
  id: string;
  download?: boolean;
  label?: string;
}) {
  const [view, setView] = useState<{ asset: Asset; url: string } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      url: string | undefined;
    getAsset(storeId, id)
      .then((asset) => {
        if (!asset) {
          if (active) setError("Файл не найден в этом магазине.");
          return;
        }
        if (active) {
          url = URL.createObjectURL(asset.blob);
          setView({ asset, url });
        }
      })
      .catch(() => {
        if (active) setError("Не удалось загрузить файл.");
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [storeId, id]);
  return (
    <figure className="asset-preview">
      {view ? (
        view.asset.type === "image" ? (
          <img src={view.url} alt={label || view.asset.name} loading="lazy" />
        ) : (
          <video
            controls
            playsInline
            preload="metadata"
            src={view.url}
            aria-label={label || view.asset.name}
          />
        )
      ) : (
        <div className="asset-placeholder">{error || "Загружаем файл…"}</div>
      )}
      <figcaption>
        {label || view?.asset.name}
        {download && view && (
          <a
            className="button secondary"
            href={view.url}
            download={view.asset.name}
          >
            Скачать{" "}
            {view.asset.type === "video"
              ? view.asset.mime.split("/")[1].toUpperCase()
              : "PNG"}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
