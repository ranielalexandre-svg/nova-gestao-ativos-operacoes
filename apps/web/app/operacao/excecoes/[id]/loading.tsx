export default function LoadingExcecaoDetalhe() {
  return (
    <div className="grid gap-5">
      <div className="h-44 animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="h-[38rem] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
        <div className="h-[38rem] animate-pulse rounded-[22px] border border-white/8 bg-white/[0.03]" />
      </div>
    </div>
  );
}
