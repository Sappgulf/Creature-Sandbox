export function applyUiExportMethods(UIController) {
  // Anchor clicks only work reliably in Firefox/Safari while the element is
  // attached to the document; the old detached click silently did nothing on
  // some browsers.
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  UIController.prototype.exportSnapshot = function () {
    const analytics = this.subsystems?.analytics;
    if (!analytics) {
      this.notifications?.show?.('Analytics unavailable', 'info', 1800);
      return;
    }
    const data = analytics.snapshot();
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `creature-sim-snapshot-${Date.now()}.json`
    );
    this.notifications?.show?.('📊 Snapshot exported', 'success', 2000);
  };

  UIController.prototype.exportCSV = function () {
    const analytics = this.subsystems?.analytics;
    if (!analytics) {
      this.notifications?.show?.('Analytics unavailable', 'info', 1800);
      return;
    }
    downloadBlob(
      new Blob([analytics.exportAsCSV()], { type: 'text/csv' }),
      `creature-sim-population-${Date.now()}.csv`
    );
    this.notifications?.show?.('📈 Population CSV exported', 'success', 2000);
  };

  UIController.prototype.exportGenesCSV = function () {
    const analytics = this.subsystems?.analytics;
    if (!analytics) {
      this.notifications?.show?.('Analytics unavailable', 'info', 1800);
      return;
    }
    downloadBlob(
      new Blob([analytics.exportGeneHistoryCSV()], { type: 'text/csv' }),
      `creature-sim-genes-${Date.now()}.csv`
    );
    this.notifications?.show?.('🧬 Gene history CSV exported', 'success', 2000);
  };
}
