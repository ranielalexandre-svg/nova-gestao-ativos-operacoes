export default function LoadingOperacao() {
  return (
    <div className="nova-loading-stack">
      <div className="nova-loading-block" data-size="header" />
      <div className="nova-loading-grid nova-loading-grid--two">
        <div className="nova-loading-block" data-size="panel" />
        <div className="nova-loading-block" data-size="panel" />
      </div>
      <div className="nova-loading-block" data-size="table" />
    </div>
  );
}
