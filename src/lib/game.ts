import CanvasManager from './canvas-manager';
import { generateMazeSync } from './maze-generator';
import { Cell, Cord, Direction, CanvasOrNull, Control, Player, Gold, MapItem } from '../type';
import { generateGold, checkGoldCollision } from './gold-logic';
import { checkMapItemCollision, generateMapItems, isEffectActive } from './item-logic';
import { hasDirection } from './direction-util';
import { generatePlayer, randomColorFromString } from './misc-util';
import {
  MAX_SPEED,
  PLAYER_RADIUS_TO_CELL_RATIO as MARGIN,
  START_POS,
  MAZE_SEED,
  VIEWPORT_SIZE
} from '../constants';

export default class Game {
  private canvasManager: CanvasManager;

  private level: number;

  private maze: Cell[][];

  private gridSize: number;

  private player: Player;

  private opPositions?: Map<string, Cord>;

  private seed?: number;

  private goldItems: Gold[];

  private mapItems: MapItem[];

  private playersMap?: Map<string, Player>;

  private onGoldHit?: (gold: Gold) => void;

  private onMapItemHit?: (item: MapItem) => void;

  private activeGoldCollisionId?: string;

  private activeItemCollisionId?: string;

  private viewportSize = VIEWPORT_SIZE;

  constructor(
    canvas: CanvasOrNull,
    level: number,
    seed?: number,
    pid?: string,
    onGoldHit?: (gold: Gold) => void,
    onMapItemHit?: (item: MapItem) => void
  ) {
    this.seed = seed || MAZE_SEED;
    this.level = level;
    this.gridSize = level; // Use the provided level as size
    this.player = generatePlayer(START_POS, pid);
    this.maze = generateMazeSync(this.gridSize, this.seed);
    this.canvasManager = new CanvasManager(canvas);
    this.goldItems = generateGold(this.gridSize, this.seed);
    this.mapItems = generateMapItems(this.gridSize, this.seed);
    this.onGoldHit = onGoldHit;
    this.onMapItemHit = onMapItemHit;
  }

  public getMaze = (): Cell[][] => {
    return this.maze;
  };

  public getMyPlayer = (): Player => {
    return this.player;
  };

  public getGoldItems = (): Gold[] => {
    return this.goldItems;
  };

  public getCanvasManager = (): CanvasManager => {
    return this.canvasManager;
  };

  public getMapItems = (): MapItem[] => {
    return this.mapItems;
  };

  public getSeed = (): number | undefined => {
    return this.seed;
  };

  public setOpponentsPos = (positions: Map<string, Cord>): void => {
    this.opPositions = positions;
  };

  public setGoldItems = (golds: Gold[]): void => {
    this.goldItems = golds;
  };

  public setPlayersMap = (players: Map<string, Player>): void => {
    this.playersMap = players;
  };

  public setMapItems = (items: MapItem[]): void => {
    this.mapItems = items;
  };

  public setViewportSize = (viewportSize: number): void => {
    this.viewportSize = viewportSize;
  };

  public setCanvas = (canvas: CanvasOrNull): void => {
    this.canvasManager = new CanvasManager(canvas);
  };

  public performMove = (control: Control): void => {
    const { magnitude, angle } = control;
    let nr = this.player.location.r;
    let nc = this.player.location.c;
    nr += -MAX_SPEED * magnitude * Math.sin(angle);
    nc += MAX_SPEED * magnitude * Math.cos(angle);
    this.player.location = this.getBoundedCord(nr, nc);

    const hitGold = checkGoldCollision(this.player.location, this.goldItems, MARGIN);
    if (!hitGold) {
      this.activeGoldCollisionId = undefined;
    } else if (hitGold.id !== this.activeGoldCollisionId && this.onGoldHit) {
      this.activeGoldCollisionId = hitGold.id;
      this.onGoldHit(hitGold);
    }

    const hitItem = checkMapItemCollision(this.player.location, this.mapItems, MARGIN);
    if (!hitItem) {
      this.activeItemCollisionId = undefined;
      return;
    }

    if (hitItem.id !== this.activeItemCollisionId && this.onMapItemHit) {
      this.activeItemCollisionId = hitItem.id;
      this.onMapItemHit(hitItem);
    }
  };

  public renderGame = (): void => {
    if (!this.canvasManager) return;
    this.canvasManager.refreshContext();
    this.canvasManager.drawGrid(this.maze, this.player.location, this.viewportSize);
    const currentPlayer = this.playersMap?.get(this.player.id) || this.player;
    if (isEffectActive(currentPlayer.effects?.torchUntil)) {
      this.canvasManager.drawTorchTrail(this.getPathToGoal());
    }
    this.canvasManager.drawMapItems(this.mapItems);
    this.canvasManager.drawGolds(this.goldItems);
    this.canvasManager.drawStartFinish(this.maze);
    this.opPositions?.forEach((pos, id) => {
      const player = this.playersMap?.get(id);
      this.canvasManager.drawPlayer(
        pos,
        randomColorFromString(id),
        this.player.location,
        player?.name,
        player?.effects,
        player?.shieldCount || 0
      );
    });
    const { location, id, name } = this.player;
    this.canvasManager.drawPlayer(
      location,
      randomColorFromString(id),
      this.player.location,
      name,
      currentPlayer.effects,
      currentPlayer.shieldCount || 0
    );
  };

  public checkWin = (): boolean => {
    const dr = Math.abs(this.player.location.r - (this.gridSize - 0.5));
    const dc = Math.abs(this.player.location.c - (this.gridSize - 0.5));
    return dr <= 0.5 && dc <= 0.5;
  };

  private getBoundedCord = (nr: number, nc: number): Cord => {
    const { r, c } = this.player.location;
    const [tr, tc] = [Math.floor(r), Math.floor(c)];
    const cell = this.maze[tr][tc];
    if (hasDirection(cell, Direction.TOP)) nr = Math.max(tr + MARGIN, nr);
    if (hasDirection(cell, Direction.DOWN)) nr = Math.min(tr + 1 - MARGIN, nr);
    if (hasDirection(cell, Direction.LEFT)) nc = Math.max(tc + MARGIN, nc);
    if (hasDirection(cell, Direction.RIGHT)) nc = Math.min(tc + 1 - MARGIN, nc);
    return { r: nr, c: nc };
  };

  private getPathToGoal = (): Cord[] => {
    const start = {
      r: Math.max(0, Math.min(this.gridSize - 1, Math.floor(this.player.location.r))),
      c: Math.max(0, Math.min(this.gridSize - 1, Math.floor(this.player.location.c)))
    };
    const goal = { r: this.gridSize - 1, c: this.gridSize - 1 };
    const queue: Array<{ r: number; c: number }> = [start];
    const visited = new Set<string>([`${start.r},${start.c}`]);
    const parent = new Map<string, string>();

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      if (current.r === goal.r && current.c === goal.c) break;

      const cell = this.maze[current.r][current.c];
      const nextSteps: Array<{ blocked: Direction; next: { r: number; c: number } }> = [
        { blocked: Direction.TOP, next: { r: current.r - 1, c: current.c } },
        { blocked: Direction.RIGHT, next: { r: current.r, c: current.c + 1 } },
        { blocked: Direction.DOWN, next: { r: current.r + 1, c: current.c } },
        { blocked: Direction.LEFT, next: { r: current.r, c: current.c - 1 } }
      ];

      nextSteps.forEach(({ blocked, next }) => {
        if (hasDirection(cell, blocked)) return;
        if (next.r < 0 || next.c < 0 || next.r >= this.gridSize || next.c >= this.gridSize) return;
        const key = `${next.r},${next.c}`;
        if (visited.has(key)) return;
        visited.add(key);
        parent.set(key, `${current.r},${current.c}`);
        queue.push(next);
      });
    }

    const path: Cord[] = [];
    let key = `${goal.r},${goal.c}`;
    if (!visited.has(key)) return path;

    while (key) {
      const [r, c] = key.split(',').map(Number);
      path.push({ r: r + 0.5, c: c + 0.5 });
      key = parent.get(key) || '';
    }

    path.reverse();
    return path.slice(0, 8);
  };
}
