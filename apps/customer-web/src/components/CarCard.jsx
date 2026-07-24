import React from "react";
import { ArrowUpRight, Camera, Gauge, MapPin } from "lucide-react";
import { carImages, carName, mileageLabel, priceLabel } from "../lib/api";
import VehicleImage from "./VehicleImage";

export default function CarCard({ car }) {
  const images = carImages(car);
  const image = images[0];

  return (
    <a
      href={`/cars/${encodeURIComponent(car.id)}`}
      className="group block overflow-hidden border border-white/10 bg-[#121417] text-white transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-[#15181c] hover:shadow-[0_24px_70px_rgba(0,0,0,.4)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
        {image ? (
          <VehicleImage
            sources={images}
            alt={carName(car)}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#1c1f24,#111317)] text-sm font-semibold text-neutral-500">
            Photos coming soon
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap gap-1.5">
            {(car.labels || []).slice(0, 2).map((label) => (
              <span key={label} className="bg-[#ef3f32] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-white">
                {label}
              </span>
            ))}
          </div>
          {images.length > 1 && (
            <span className="flex items-center gap-1.5 bg-black/72 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur">
              <Camera size={12} /> {images.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-black uppercase tracking-[.15em] text-[#d92d22]">
            <MapPin size={12} className="shrink-0" /> {car.lot_name}
          </p>
          {car.stock && <span className="shrink-0 text-[10px] font-semibold text-neutral-500">Stock {car.stock}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-[3.3rem] text-[21px] font-black leading-[1.18] tracking-[-.035em]">
          {carName(car)}
        </h3>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            <small className="block text-[9px] font-bold uppercase tracking-[.14em] text-neutral-400">Price</small>
            <strong className="mt-1 block text-[22px] font-black tracking-[-.035em]">{priceLabel(car)}</strong>
          </div>
          <span className="mb-1 flex shrink-0 items-center gap-1.5 text-sm font-semibold text-neutral-400">
            <Gauge size={15} /> {mileageLabel(car)}
          </span>
        </div>
        <span className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-black uppercase tracking-[.12em] text-neutral-300">
          View vehicle <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </a>
  );
}
