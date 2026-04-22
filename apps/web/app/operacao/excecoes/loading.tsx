export default function LoadingExcecoes() {
  return (
    <div className="grid gap-5">
      <div className="h-24 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="h-[34rem] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
        <div className="h-[34rem] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
      </div>
    </div>
  );
}
