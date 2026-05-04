export default function LoadingExcecaoDetalhe() {
  return (
    <div className="nova-loading-stack">
      <div className="nova-loading-block" data-size="header" />
      <div className="nova-side-grid nova-side-grid--360 nova-side-grid--wide-main">
        <div className="nova-loading-block" data-size="detail" />
        <div className="nova-loading-block" data-size="detail" />
      </div>
    </div>
  );
}
