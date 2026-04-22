export default function LoadingOperacao() {
  return (
    <div className="grid gap-5">
      <div className="h-28 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="h-64 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
        <div className="h-64 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
      </div>
      <div className="h-64 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
    </div>
  );
}
