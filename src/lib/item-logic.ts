import { Cord, ItemType, MapItem, PlayerEffects, PlayerInventory } from '../type';
import { SeededRandom } from './gold-logic';

const ITEM_COUNTS: Array<{ type: ItemType; count: number; trap?: boolean }> = [
  { type: 'torch', count: 2 },
  { type: 'boom', count: 5 },
  { type: 'flash', count: 5 },
  { type: 'net', count: 5 },
  { type: 'banana', count: 10, trap: true },
  { type: 'shield', count: 5 },
  { type: 'smoke', count: 5 }
];

const DEFAULT_INVENTORY: PlayerInventory = {
  torch: 0,
  boom: 0,
  flash: 0,
  net: 0,
  shield: 0,
  smoke: 0
};

const DEFAULT_EFFECTS: PlayerEffects = {
  reversedUntil: null,
  rootedUntil: null,
  flashedUntil: null,
  smokedUntil: null,
  torchUntil: null,
  explosionUntil: null,
  shieldPulseUntil: null
};

export function createDefaultInventory(): PlayerInventory {
  return { ...DEFAULT_INVENTORY };
}

export function createDefaultEffects(): PlayerEffects {
  return { ...DEFAULT_EFFECTS };
}

export function generateMapItems(size: number, seed: number): MapItem[] {
  const rng = new SeededRandom(seed + 2026);
  const items: MapItem[] = [];
  const usedPositions = new Set<string>();

  usedPositions.add('0,0');
  usedPositions.add(`${size - 1},${size - 1}`);

  ITEM_COUNTS.forEach(({ type, count, trap }) => {
    for (let i = 0; i < count; i++) {
      let r = 0;
      let c = 0;
      do {
        r = rng.nextInt(0, size - 1);
        c = rng.nextInt(0, size - 1);
      } while (usedPositions.has(`${r},${c}`));

      usedPositions.add(`${r},${c}`);
      items.push({
        id: `${type}-${i}`,
        type,
        trap: Boolean(trap),
        location: { r: r + 0.5, c: c + 0.5 },
        collectedBy: null,
        consumedBy: null
      });
    }
  });

  return items;
}

export function checkMapItemCollision(
  playerLoc: Cord,
  items: MapItem[],
  radius: number
): MapItem | null {
  for (const item of items) {
    if (item.collectedBy || item.consumedBy) continue;

    const dr = playerLoc.r - item.location.r;
    const dc = playerLoc.c - item.location.c;
    const dist = Math.sqrt(dr * dr + dc * dc);

    if (dist < radius + 0.18) {
      return item;
    }
  }

  return null;
}

export function isEffectActive(until?: number | null, now = Date.now()): boolean {
  return typeof until === 'number' && until > now;
}
