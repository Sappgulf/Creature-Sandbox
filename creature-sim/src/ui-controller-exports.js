export function applyUiExportMethods(UIController) {
  UIController.prototype.exportSnapshot = function() {
    if (this.subsystems.analytics) {
      const data = this.subsystems.analytics.snapshot();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-snapshot-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.hasNotifications()) {
        this.notifications.show('📊 Snapshot exported', 'success', 2000);
      }
    }
  };

  UIController.prototype.exportCSV = function() {
    if (this.subsystems.analytics) {
      const csv = this.subsystems.analytics.exportAsCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-population-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.hasNotifications()) {
        this.notifications.show('📈 Population CSV exported', 'success', 2000);
      }
    }
  };

  UIController.prototype.exportGenesCSV = function() {
    if (this.subsystems.analytics) {
      const csv = this.subsystems.analytics.exportGeneHistoryCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-genes-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.hasNotifications()) {
        this.notifications.show('🧬 Gene history CSV exported', 'success', 2000);
      }
    }
  };
}
