import { CloudOff, Sparkles } from "lucide-react";

export default function OfflinePage() {
  return <main className="grid min-h-screen place-items-center bg-[#eef2f4] px-5 text-center text-[#10231e]"><div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-[#102820] text-[#c9ff4d]"><CloudOff className="size-7"/></div><h1 className="mt-7 text-3xl font-semibold tracking-[-.05em]">Sin conexión por ahora</h1><p className="mt-3 leading-7 text-[#66766f]">Lúmina protege tus datos y no guarda respuestas financieras en la caché. Cuando vuelvas a tener internet, retoma desde donde estabas.</p><a href="/app" className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-[#102820] px-5 font-semibold text-white"><Sparkles className="size-4"/> Reintentar</a></div></main>;
}
