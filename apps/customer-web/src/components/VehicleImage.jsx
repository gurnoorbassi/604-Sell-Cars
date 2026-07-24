import React, { useEffect, useMemo, useState } from "react";
import { CarFront } from "lucide-react";

export default function VehicleImage({
  sources = [],
  alt,
  className = "",
  loading = "lazy",
  fetchPriority,
  fallbackLabel = "Photo unavailable",
}) {
  const usableSources = useMemo(() => sources.filter(Boolean), [sources]);
  const sourceKey = usableSources.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [sourceKey]);

  if (index >= usableSources.length) {
    return (
      <div className={`grid place-items-center bg-[linear-gradient(135deg,#e8e8e5,#cececa)] text-neutral-500 ${className}`} role="img" aria-label={alt}>
        <span className="flex flex-col items-center gap-2 text-xs font-bold uppercase tracking-[.12em]">
          <CarFront size={30} strokeWidth={1.6} />
          {fallbackLabel}
        </span>
      </div>
    );
  }

  return (
    <img
      src={usableSources[index]}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      className={className}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
