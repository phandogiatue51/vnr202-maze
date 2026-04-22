import { Cell, Cord, OnUpdate, Config, Direction } from '../type';
import { ALL_DIRS_CELL, getDirCordOffset, getOPDir, hasDirection, removeDir } from './direction-util';

export const START_CORD = { r: 0, c: 0 };

let globalSeed: number = Math.random() * 1e9;
let maze: Cell[][];
let seen: boolean[][];
const EXTRA_CONNECTION_RATE = 0.08;

export function isValidGrid(grid?: Cell[][]): boolean {
  if (!grid) return false;
  if (grid.length === 0) return false;
  const size = grid.length;
  const col = grid.reduce((prev, row) => {
    if (!row || row.length !== prev) return -1;
    return prev;
  }, size);
  if (col === -1) return false;
  return true;
}

export function breakWall(grid: Cell[][], cord: Cord, dir: Direction): void {
  const { r, c } = cord;
  grid[r][c] = removeDir(grid[r][c], dir);
}

export function create2DArray<T>(size: number, val: T): T[][] {
  const arr = new Array<Array<T>>(size);
  return arr.fill([]).map(() => new Array<T>(size).fill(val));
}

export function getRandomSeed(): number {
  return Math.floor(Math.random() * 100000);
}

function setSeed(inputSeed?: number) {
  if (inputSeed) globalSeed = inputSeed;
  else globalSeed = Math.random() * 1e9;
}

export function rand(): number {
  if (!globalSeed) return Math.random();
  const x = Math.sin(globalSeed) * 100000;
  globalSeed++;
  return x - Math.floor(x);
}

export function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const ind = Math.floor(rand() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[ind];
    arr[ind] = temp;
  }
}

export function getDirs(): Direction[] {
  const dirs = [Direction.TOP, Direction.RIGHT, Direction.DOWN, Direction.LEFT];
  shuffle(dirs);
  return dirs;
}

export function getNextCord(cord: Cord, dir: Direction): Cord {
  const delta = getDirCordOffset(dir);
  if (!delta) throw new Error('Delta not found.');
  return { r: cord.r + delta[0], c: cord.c + delta[1] };
}

export function isOutOfBound(grid: Cell[][], cord: Cord): boolean {
  const { r, c } = cord;
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) return true;
  return false;
}

export function isVisited(cord: Cord): boolean {
  const { r, c } = cord;
  return seen[r][c];
}

export function visit(cord: Cord): void {
  const { r, c } = cord;
  seen[r][c] = true;
}

async function depthFirstSearch(startCord: Cord, update?: OnUpdate): Promise<void> {
  const stack: Cord[] = [startCord];
  visit(startCord);
  if (update) await update(maze, startCord);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const dirs = getDirs();
    let found = false;

    for (const dir of dirs) {
      const next = getNextCord(current, dir);
      if (!isOutOfBound(maze, next) && !isVisited(next)) {
        breakWall(maze, current, dir);
        breakWall(maze, next, getOPDir(dir));
        visit(next);
        if (update) await update(maze, next);
        stack.push(next);
        found = true;
        break;
      }
    }

    if (!found) {
      stack.pop();
    }
  }
}

function depthFirstSearchSync(startCord: Cord): void {
  const stack: Cord[] = [startCord];
  visit(startCord);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const dirs = getDirs();
    let found = false;

    for (const dir of dirs) {
      const next = getNextCord(current, dir);
      if (!isOutOfBound(maze, next) && !isVisited(next)) {
        breakWall(maze, current, dir);
        breakWall(maze, next, getOPDir(dir));
        visit(next);
        stack.push(next);
        found = true;
        break;
      }
    }

    if (!found) {
      stack.pop();
    }
  }
}

function countOpenings(cell: Cell): number {
  let openings = 0;
  if (!hasDirection(cell, Direction.TOP)) openings++;
  if (!hasDirection(cell, Direction.RIGHT)) openings++;
  if (!hasDirection(cell, Direction.DOWN)) openings++;
  if (!hasDirection(cell, Direction.LEFT)) openings++;
  return openings;
}

function ensureStartBranch(grid: Cell[][]): void {
  const start = START_CORD;
  if (countOpenings(grid[start.r][start.c]) >= 2) return;

  const candidates = [Direction.RIGHT, Direction.DOWN];
  for (const dir of candidates) {
    if (!hasDirection(grid[start.r][start.c], dir)) continue;
    const next = getNextCord(start, dir);
    if (isOutOfBound(grid, next)) continue;
    breakWall(grid, start, dir);
    breakWall(grid, next, getOPDir(dir));
    break;
  }
}

function carveExtraConnections(grid: Cell[][]): void {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cord = { r, c };
      const dirs = [Direction.RIGHT, Direction.DOWN];
      for (const dir of dirs) {
        if (rand() >= EXTRA_CONNECTION_RATE) continue;
        if (!hasDirection(grid[r][c], dir)) continue;
        const next = getNextCord(cord, dir);
        if (isOutOfBound(grid, next)) continue;
        breakWall(grid, cord, dir);
        breakWall(grid, next, getOPDir(dir));
      }
    }
  }
}

export async function generateMaze(size: number, params: Config = {}): Promise<Cell[][]> {
  const { userSeed, onUpdate } = params;
  maze = create2DArray<Cell>(size, ALL_DIRS_CELL);
  seen = create2DArray<boolean>(size, false);
  setSeed(userSeed);
  await depthFirstSearch(START_CORD, onUpdate);
  carveExtraConnections(maze);
  ensureStartBranch(maze);
  return maze;
}

export function generateMazeSync(size: number, userSeed?: number): Cell[][] {
  maze = create2DArray<Cell>(size, ALL_DIRS_CELL);
  seen = create2DArray<boolean>(size, false);
  setSeed(userSeed);
  depthFirstSearchSync(START_CORD);
  carveExtraConnections(maze);
  ensureStartBranch(maze);
  return maze;
}
