import React from "react";
import { ArrowUpRight, Gauge, MapPin } from "lucide-react";
import { carImages, carName, mileageLabel, priceLabel } from "../lib/api";

export default function CarCard({ car }) {
  const image = carImages(car)[0];
  return (
    <a href={`/cars/${encodeURIComponent(car.id)}`}
      className="group overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-950 shadow-[0_8px_30px_rgba(20,20,20,.06)] transition duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_18px_45px_rgba(20,20,20,.12)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-200">
        {image ? (
          <img src={image} alt={carName(car)} loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        ) : <div className="grid h-full place-items-center text-sm font-semibold text-neutral-500">Photos coming soon</div>}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap gap-1.5">
            {(car.labels || []).slice(0, 2).map((label) => (
              <span key={label} className="rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-white shadow">{label}</span>
            ))}
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-neutral-900 opacity-0 shadow transition group-hover:opacity-100">
            <ArrowUpRight size={17} />
          </span>
        </div>
      </div>
      <div className="p-5">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.16em] text-red-600">
          <MapPin size={12} />{car.lot_name}
        </p>
        <h3 className="mt-2 line-clamp-2 min-h-[3.2rem] text-xl font-black leading-tight tracking-[-.025em]">{carName(car)}</h3>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-neutral-100 pt-4">
          <strong className="text-xl font-black tracking-tight">{priceLabel(car)}</strong>
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-neutral-500">
            <Gauge size={15} />{mileageLabel(car)}
          </span>
        </div>
      </div>
    </a>
  );
}
