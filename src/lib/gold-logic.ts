import { Cord, Gold, Question } from '../type';
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

export function checkGoldCollision(playerLoc: Cord, goldList: Gold[], radius: number): Gold | null {
  for (const gold of goldList) {
    if (gold.collectedBy) continue;

    const dr = playerLoc.r - gold.location.r;
    const dc = playerLoc.c - gold.location.c;
    const dist = Math.sqrt(dr * dr + dc * dc);

    // Using a collision threshold (player radius + gold radius)
    // 0.4 cell units is roughly 40% of a cell, which feels tight but responsive
    if (dist < radius + 0.2) {
      return gold;
    }
  }
  return null;
}
