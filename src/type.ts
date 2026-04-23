import { KeyboardEventHandler, MutableRefObject } from 'react';

// eslint-disable-next-line
export enum Direction {
  TOP = 1, // 0001
  RIGHT = 2, // 0010
  DOWN = 4, // 0100
  LEFT = 8 // 1000
}
export type Link = { name: string; url: string };
export type Cell = number;
export type Cord = { r: number; c: number };
export type OnUpdate = (grid: Cell[][], cord: Cord) => Promise<void>;
export type Config = { userSeed?: number; onUpdate?: OnUpdate };
export type CanvasOrNull = HTMLCanvasElement | null;
export type Ctx = CanvasRenderingContext2D;
export type Control = { magnitude: number; angle: number };
export type Player = {
  id: string;
  name?: string;
  location: Cord;
  goldCount?: number;
  inventory?: PlayerInventory;
  effects?: PlayerEffects;
  shieldCount?: number;
  finishTime?: number | null;
  reachedGoal?: boolean;
  joinedAt?: number;
  startTime?: number | null;
};
export type RRef<T> = MutableRefObject<T>;
export type KHandler<T> = KeyboardEventHandler<T>;
export type Context = { ctx: Ctx; width: number; height: number };
export type CallBack = (success?: boolean, message?: string) => void;
export interface StringMap {
  [key: string]: number;
}
export interface Question {
  id: number;
  text: string;
  options: string[];
  answer: string;
}
export interface Gold {
  id: string;
  location: Cord;
  collectedBy: string | null;
  question: Question;
}

export type ItemType = 'torch' | 'boom' | 'flash' | 'net' | 'banana' | 'shield' | 'smoke';

export type PlayerInventory = Partial<Record<Exclude<ItemType, 'banana'>, number>>;

export type PlayerEffects = {
  reversedUntil?: number | null;
  rootedUntil?: number | null;
  flashedUntil?: number | null;
  smokedUntil?: number | null;
  torchUntil?: number | null;
  explosionUntil?: number | null;
  shieldPulseUntil?: number | null;
};

export interface MapItem {
  id: string;
  type: ItemType;
  location: Cord;
  trap?: boolean;
  collectedBy?: string | null;
  consumedBy?: string | null;
}
