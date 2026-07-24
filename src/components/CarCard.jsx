import React from "react";
import { carImages, carName } from "../lib/api";

export default function CarCard({ car }) {
  const image = carImages(car)[0];
  return (
    <a href={`/site/cars/${encodeURIComponent(car.id)}`} className="group overflow-hidden border border-neutral-200 bg-white text-neutral-950 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
        {image ? (
          <img src={image} alt={carName(car)} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : <div className="grid h-full place-items-center text-sm text-neutral-500">Photos coming soon</div>}
        <div className="absolute left-3 top-3 flex gap-1">
          {(car.labels || []).slice(0, 2).map((label) => <span key={label} className="bg-red-600 px-2 py-1 text-[10px] font-black text-white">{label}</span>)}
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-red-600">{car.lot_name}</p>
        <h3 className="mt-1 text-lg font-black tracking-tight">{carName(car)}</h3>
        <div className="mt-4 flex items-end justify-between">
          <strong className="text-xl">${Number(car.price_amount || 0).toLocaleString()}</strong>
          <span className="text-sm text-neutral-500">{Number(car.mileage || 0).toLocaleString()} km</span>
        </div>
      </div>
    </a>
  );
}
