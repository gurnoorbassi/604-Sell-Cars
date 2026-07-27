import React from "react";
import { ArrowUpRight, Camera, Gauge, MapPin } from "lucide-react";
import { carImages, carName, mileageLabel, priceLabel } from "../lib/api";
import VehicleImage from "./VehicleImage";

export default function CarCard({ car }) {
  const images = carImages(car);
  const preferredImages = /rolls[\s-]*royce.*ghost/i.test(`${car.title || ""} ${carName(car)}`) && images.length > 1
    ? [images[1], ...images.filter((_, index) => index !== 1)]
    : images;
  return (
    <a href={`/cars/${encodeURIComponent(car.id)}`} className="reveal-card group block min-w-0 transition duration-300 hover:-translate-y-1 hover:drop-shadow-[0_20px_30px_rgba(0,0,0,.35)]">
      <div className="relative aspect-[4/3] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_center,#1a1d22_0%,#0c0e11_72%)]">
        {preferredImages[0] ? (
          <VehicleImage sources={preferredImages} alt={carName(car)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#171a1f,#0c0e11)] text-xs font-bold uppercase tracking-[.12em] text-neutral-600">
            Photos coming soon
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap gap-1.5">
            {(car.public_labels || []).slice(0, 1).map((label) => (
              <span key={label} className="bg-[#ef3f32] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.14em] text-white">{label}</span>
            ))}
          </div>
          {images.length > 1 && (
            <span className="flex items-center gap-1.5 bg-black/75 px-2.5 py-1.5 text-[9px] font-bold text-white backdrop-blur">
              <Camera size={11} />{images.length}
            </span>
          )}
        </div>
        <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center bg-white text-black opacity-0 transition group-hover:opacity-100">
          <ArrowUpRight size={15} />
        </span>
      </div>

      <div className="border-b border-white/10 pb-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[9px] font-black uppercase tracking-[.14em] text-[#ff5a50]">
            <MapPin size={11} className="shrink-0" />{car.location_label}
          </p>
          {car.stock && <span className="shrink-0 text-[9px] font-semibold text-neutral-600">#{car.stock}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-[3.1rem] text-xl font-black leading-[1.2] tracking-[-.035em] transition group-hover:text-[#ff5a50]">{carName(car)}</h3>
        <div className="mt-4 flex items-end justify-between gap-3">
          <strong className="text-2xl font-black tracking-[-.04em]">{priceLabel(car)}</strong>
          <span className="mb-0.5 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-400">
            <Gauge size={14} />{mileageLabel(car)}
          </span>
        </div>
      </div>
    </a>
  );
}
