export const HUD_MENU_GROUPS = [
  {
    id: 'simulation',
    label: 'Simulation'
  },
  {
    id: 'progress',
    label: 'Progress'
  },
  {
    id: 'tools',
    label: 'Tools'
  },
  {
    id: 'insights',
    label: 'Insights'
  },
  {
    id: 'developer',
    label: 'Developer'
  }
];

export function createHudMenuActions(handlers = {}) {
  return [
    {
      id: 'btn-mode',
      label: 'Modes & Goals',
      icon: '🎛️',
      group: 'simulation',
      shortcut: '',
      handler: handlers.onSessionMetaToggle,
      enabledWhen: () => true,
      primary: true,
      context: 'Global',
      frequency: 'High',
      risk: 'Medium'
    },
    {
      id: 'btn-pause',
      label: 'Pause/Resume',
      icon: '⏯️',
      group: 'simulation',
      shortcut: 'Space',
      handler: handlers.onPause,
      enabledWhen: () => true,
      primary: true,
      context: 'Global',
      frequency: 'High',
      risk: 'High'
    },
    {
      id: 'btn-step',
      label: 'Single Step',
      icon: '⏭️',
      group: 'simulation',
      shortcut: '',
      handler: handlers.onStep,
      enabledWhen: () => true,
      primary: false,
      context: 'Sandbox-only',
      frequency: 'Rare',
      risk: 'Low'
    },
    {
      id: 'btn-watch-mode',
      label: 'Watch Mode',
      icon: '👁️',
      group: 'simulation',
      shortcut: '',
      handler: handlers.onWatchModeToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Global',
      frequency: 'High',
      risk: 'Low'
    },
    {
      id: 'btn-campaign',
      label: 'Campaign Mode',
      icon: '🏆',
      group: 'progress',
      shortcut: '',
      handler: handlers.onCampaignToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Global',
      frequency: 'Medium',
      risk: 'Medium'
    },
    {
      id: 'btn-achievements',
      label: 'Achievements',
      icon: '🏅',
      group: 'progress',
      shortcut: '',
      handler: handlers.onAchievementsToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Global',
      frequency: 'Medium',
      risk: 'Low'
    },
    {
      id: 'btn-scenario',
      label: 'Scenario Lab',
      icon: '🧪',
      group: 'tools',
      shortcut: '',
      handler: handlers.onScenarioToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Editor-only',
      frequency: 'Medium',
      risk: 'Medium'
    },
    {
      id: 'btn-gene-editor',
      label: 'Gene Editor',
      icon: '🧬',
      group: 'tools',
      shortcut: '',
      handler: handlers.onGeneEditorToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Editor-only',
      frequency: 'Medium',
      risk: 'High'
    },
    {
      id: 'btn-eco-health',
      label: 'Ecosystem Health',
      icon: '🌍',
      group: 'insights',
      shortcut: '',
      handler: handlers.onEcoHealthToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Sandbox-only',
      frequency: 'Medium',
      risk: 'Low'
    },
    {
      id: 'btn-features',
      label: 'Features',
      icon: '🎨',
      group: 'tools',
      shortcut: '',
      handler: handlers.onFeaturesToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Global',
      frequency: 'Rare',
      risk: 'Low'
    },
    {
      id: 'btn-god-mode',
      label: 'God Mode',
      icon: '✨',
      group: 'tools',
      shortcut: '',
      handler: handlers.onGodModeToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Sandbox-only',
      frequency: 'Rare',
      risk: 'Medium'
    },
    {
      id: 'analytics-dashboard-toggle',
      label: 'Analytics Dashboard',
      icon: '📊',
      group: 'insights',
      shortcut: '',
      handler: handlers.onAnalyticsToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Sandbox-only',
      frequency: 'Medium',
      risk: 'Medium'
    },
    {
      id: 'debug-console-toggle',
      label: 'Debug Console',
      icon: '🔧',
      group: 'developer',
      shortcut: '',
      handler: handlers.onDebugToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Debug-only',
      frequency: 'Rare',
      risk: 'Low'
    },
    {
      id: 'performance-monitor-toggle',
      label: 'Performance Monitor',
      icon: '⚡',
      group: 'developer',
      shortcut: '',
      handler: handlers.onPerformanceToggle,
      enabledWhen: () => true,
      primary: false,
      context: 'Debug-only',
      frequency: 'Rare',
      risk: 'Low'
    }
  ];
}
