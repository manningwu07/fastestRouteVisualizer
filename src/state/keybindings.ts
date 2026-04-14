export interface KeyBinding {
  id: string;
  label: string;
  defaultKey: string;
  defaultModifiers: string[];
  category: 'general' | 'builder' | 'pathfinder';
}

export const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  // General
  { id: 'mode_builder', label: 'Builder mode', defaultKey: '1', defaultModifiers: [], category: 'general' },
  { id: 'mode_pathfinder', label: 'Pathfinder mode', defaultKey: '2', defaultModifiers: [], category: 'general' },
  { id: 'deselect', label: 'Deselect / close panels', defaultKey: 'Escape', defaultModifiers: [], category: 'general' },
  { id: 'save_graph', label: 'Save graph to localStorage', defaultKey: 's', defaultModifiers: ['ctrl'], category: 'general' },
  { id: 'export_graph', label: 'Export graph as file', defaultKey: 's', defaultModifiers: ['ctrl', 'shift'], category: 'general' },
  { id: 'load_graph', label: 'Load graph', defaultKey: 'o', defaultModifiers: ['ctrl'], category: 'general' },
  { id: 'toggle_shortcuts', label: 'Toggle shortcuts panel', defaultKey: '?', defaultModifiers: [], category: 'general' },

  // Builder
  { id: 'tool_select', label: 'Select tool', defaultKey: 's', defaultModifiers: [], category: 'builder' },
  { id: 'tool_add_station', label: 'Add Station tool', defaultKey: 'n', defaultModifiers: [], category: 'builder' },
  { id: 'tool_add_line', label: 'Add Line tool', defaultKey: 'l', defaultModifiers: [], category: 'builder' },
  { id: 'tool_add_run_edge', label: 'Add Run Edge tool', defaultKey: 'r', defaultModifiers: [], category: 'builder' },
  { id: 'builder_undo_delete', label: 'Undo last builder delete', defaultKey: 'z', defaultModifiers: ['ctrl'], category: 'builder' },
  { id: 'delete_selected', label: 'Delete selected', defaultKey: 'Delete', defaultModifiers: [], category: 'builder' },
  { id: 'edit_selected', label: 'Edit selected item', defaultKey: 'e', defaultModifiers: [], category: 'builder' },
  { id: 'cycle_stations_forward', label: 'Cycle stations forward', defaultKey: 'Tab', defaultModifiers: [], category: 'builder' },
  { id: 'cycle_stations_backward', label: 'Cycle stations backward', defaultKey: 'Tab', defaultModifiers: ['shift'], category: 'builder' },

  // Pathfinder
  { id: 'pf_undo', label: 'Undo last step', defaultKey: 'u', defaultModifiers: [], category: 'pathfinder' },
  { id: 'pf_clear', label: 'Clear route', defaultKey: 'c', defaultModifiers: [], category: 'pathfinder' },
  { id: 'pf_save', label: 'Save current route', defaultKey: 'Enter', defaultModifiers: ['ctrl'], category: 'pathfinder' },
  { id: 'pf_cycle_forward', label: 'Cycle reachable stations', defaultKey: 'Tab', defaultModifiers: [], category: 'pathfinder' },
  { id: 'pf_cycle_backward', label: 'Cycle reachable stations (back)', defaultKey: 'Tab', defaultModifiers: ['shift'], category: 'pathfinder' },
  { id: 'pf_confirm', label: 'Confirm station selection', defaultKey: 'Enter', defaultModifiers: [], category: 'pathfinder' },
];

const STORAGE_KEY = 'transit_keybindings_overrides';

interface StoredOverride {
  key: string;
  modifiers: string[];
}

function loadOverrides(): Record<string, StoredOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveOverrides(overrides: Record<string, StoredOverride>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getKeybindings(): KeyBinding[] {
  const overrides = loadOverrides();
  return DEFAULT_KEYBINDINGS.map(kb => {
    const override = overrides[kb.id];
    if (override) {
      return { ...kb, defaultKey: override.key, defaultModifiers: override.modifiers };
    }
    return kb;
  });
}

export function setKeybinding(id: string, key: string, modifiers: string[]): void {
  const overrides = loadOverrides();
  overrides[id] = { key, modifiers };
  saveOverrides(overrides);
}

export function resetKeybinding(id: string): void {
  const overrides = loadOverrides();
  delete overrides[id];
  saveOverrides(overrides);
}

export function resetAllKeybindings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function matchesBinding(id: string, event: KeyboardEvent): boolean {
  const bindings = getKeybindings();
  const binding = bindings.find(b => b.id === id);
  if (!binding) return false;

  const eventKey = event.key;
  const mods = binding.defaultModifiers;

  // Check key match (case insensitive for letter keys)
  const keyMatches = eventKey === binding.defaultKey ||
    (binding.defaultKey.length === 1 && eventKey.toLowerCase() === binding.defaultKey.toLowerCase());

  // Check modifiers
  const ctrlMatch = mods.includes('ctrl') ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
  const shiftMatch = mods.includes('shift') ? event.shiftKey : !event.shiftKey;
  const altMatch = mods.includes('alt') ? event.altKey : !event.altKey;

  return keyMatches && ctrlMatch && shiftMatch && altMatch;
}

export function formatBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  if (binding.defaultModifiers.includes('ctrl')) parts.push('Ctrl');
  if (binding.defaultModifiers.includes('shift')) parts.push('Shift');
  if (binding.defaultModifiers.includes('alt')) parts.push('Alt');
  parts.push(binding.defaultKey);
  return parts.join('+');
}
