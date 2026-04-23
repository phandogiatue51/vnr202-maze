import { Cord, Gold, Question, GameItem, ItemType } from '../type';
import questions from '../constants/questions.json';

// Simple seeded random generator
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function generateGold(size: number, seed: number): Gold[] {
  const rng = new SeededRandom(seed + 999); // Offset from maze seed
  const goldItems: Gold[] = [];
  const usedPositions = new Set<string>();

  // Avoid start and end positions
  usedPositions.add('0,0');
  usedPositions.add(`${size - 1},${size - 1}`);

  const goldQuestions = [...questions];
  // Shuffle questions if needed, but we have 50 questions for 50 gold slots

  for (let i = 0; i < 50; i++) {
    let r: number;
    let c: number;
    do {
      r = rng.nextInt(0, size - 1);
      c = rng.nextInt(0, size - 1);
    } while (usedPositions.has(`${r},${c}`));

    usedPositions.add(`${r},${c}`);

    goldItems.push({
      id: `gold-${i}`,
      location: { r: r + 0.5, c: c + 0.5 }, // Center of cell
      collectedBy: null,
      question: goldQuestions[i] as Question
    });
  }

  return goldItems;
}

export function generateItems(size: number, seed: number): GameItem[] {
  const rng = new SeededRandom(seed + 888); // Offset from maze seed
  const items: GameItem[] = [];
  const usedPositions = new Set<string>();

  // Avoid start and end positions
  usedPositions.add('0,0');
  usedPositions.add(`${size - 1},${size - 1}`);

  // Also avoid positions where gold is generated (roughly)
  // To keep it simple, we'll just let them overlap if they must,
  // but we'll try to find unique spots for items.

  const generateTypeItems = (type: ItemType, count: number, prefix: string) => {
    for (let i = 0; i < count; i++) {
      let r: number;
      let c: number;
      do {
        r = rng.nextInt(0, size - 1);
        c = rng.nextInt(0, size - 1);
      } while (usedPositions.has(`${r},${c}`));

      usedPositions.add(`${r},${c}`);

      items.push({
        id: `${prefix}-${i}`,
        type,
        location: { r: r + 0.5, c: c + 0.5 },
        collectedBy: null
      });
    }
  };

  generateTypeItems(ItemType.SMOKE_BOMB, 20, 'smoke');
  generateTypeItems(ItemType.NET, 20, 'net');

  return items;
}

export function checkGoldCollision(playerLoc: Cord, goldList: Gold[], radius: number): Gold | null {
  for (const gold of goldList) {
    if (gold.collectedBy) continue;

    const dr = playerLoc.r - gold.location.r;
    const dc = playerLoc.c - gold.location.c;
    const dist = Math.sqrt(dr * dr + dc * dc);

    if (dist < radius + 0.2) {
      return gold;
    }
  }
  return null;
}

export function checkItemCollision(
  playerLoc: Cord,
  itemList: GameItem[],
  radius: number
): GameItem | null {
  for (const item of itemList) {
    if (item.collectedBy) continue;

    const dr = playerLoc.r - item.location.r;
    const dc = playerLoc.c - item.location.c;
    const dist = Math.sqrt(dr * dr + dc * dc);

    if (dist < radius + 0.2) {
      return item;
    }
  }
  return null;
}
