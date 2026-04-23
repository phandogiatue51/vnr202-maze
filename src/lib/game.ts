import CanvasManager from './canvas-manager';
import { generateMazeSync } from './maze-generator';
import { Cell, Cord, Direction, CanvasOrNull, Control, Player, Gold, GameItem, ItemType } from '../type';
import { generateGold, checkGoldCollision, generateItems, checkItemCollision } from './gold-logic';
import { hasDirection } from './direction-util';
import { generatePlayer, randomColorFromString } from './misc-util';
import {
  MAX_SPEED,
  PLAYER_RADIUS_TO_CELL_RATIO as MARGIN,
  START_POS,
  MAZE_SEED
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

  private gameItems: GameItem[];

  private playersMap?: Map<string, Player>;

  private onGoldHit?: (gold: Gold) => void;

  private onItemHit?: (item: GameItem) => void;

  private activeGoldCollisionId?: string;

  private activeItemCollisionId?: string;

  constructor(
    canvas: CanvasOrNull,
    level: number,
    seed?: number,
    pid?: string,
    onGoldHit?: (gold: Gold) => void,
    onItemHit?: (item: GameItem) => void
  ) {
    this.seed = seed || MAZE_SEED;
    this.level = level;
    this.gridSize = level; // Use the provided level as size
    this.player = generatePlayer(START_POS, pid);
    this.maze = generateMazeSync(this.gridSize, this.seed);
    this.canvasManager = new CanvasManager(canvas);
    this.goldItems = generateGold(this.gridSize, this.seed);
    this.gameItems = generateItems(this.gridSize, this.seed);
    this.onGoldHit = onGoldHit;
    this.onItemHit = onItemHit;
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

  public getGameItems = (): GameItem[] => {
    return this.gameItems;
  };

  public getCanvasManager = (): CanvasManager => {
    return this.canvasManager;
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

  public setGameItems = (items: GameItem[]): void => {
    this.gameItems = items;
  };

  public setPlayersMap = (players: Map<string, Player>): void => {
    this.playersMap = players;
    // Sync local player's debuffs from remote state
    if (this.player.id) {
      const remotePlayer = players.get(this.player.id);
      if (remotePlayer) {
        this.player.activeDebuffs = remotePlayer.activeDebuffs || [];
      }
    }
  };

  public setCanvas = (canvas: CanvasOrNull): void => {
    this.canvasManager = new CanvasManager(canvas);
  };

  public performMove = (control: Control): void => {
    const { magnitude, angle } = control;

    // Check if player is netted
    const now = Date.now();
    const isNetted = this.player.activeDebuffs?.some(
      (d) => d.type === ItemType.NET && now >= d.startTime && now <= d.endTime
    );

    if (isNetted) return;

    let nr = this.player.location.r;
    let nc = this.player.location.c;
    nr += -MAX_SPEED * magnitude * Math.sin(angle);
    nc += MAX_SPEED * magnitude * Math.cos(angle);
    this.player.location = this.getBoundedCord(nr, nc);

    const hitGold = checkGoldCollision(this.player.location, this.goldItems, MARGIN);
    if (hitGold) {
      if (hitGold.id !== this.activeGoldCollisionId && this.onGoldHit) {
        this.activeGoldCollisionId = hitGold.id;
        this.onGoldHit(hitGold);
      }
    } else {
      this.activeGoldCollisionId = undefined;
    }

    const hitItem = checkItemCollision(this.player.location, this.gameItems, MARGIN);
    if (hitItem) {
      if (hitItem.id !== this.activeItemCollisionId && this.onItemHit) {
        this.activeItemCollisionId = hitItem.id;
        this.onItemHit(hitItem);
      }
    } else {
      this.activeItemCollisionId = undefined;
    }
  };

  public renderGame = (): void => {
    if (!this.canvasManager) return;
    this.canvasManager.refreshContext();
    this.canvasManager.drawGrid(this.maze, this.player.location);
    this.canvasManager.drawGolds(this.goldItems);
    this.canvasManager.drawItems(this.gameItems);
    this.canvasManager.drawStartFinish(this.maze);
    this.opPositions?.forEach((pos, id) => {
      const p = this.playersMap?.get(id);
      this.canvasManager.drawPlayer(
        pos,
        randomColorFromString(id),
        this.player.location,
        p?.name,
        p?.activeDebuffs
      );
    });
    const { location, id, name, activeDebuffs } = this.player;
    this.canvasManager.drawPlayer(
      location,
      randomColorFromString(id),
      this.player.location,
      name,
      activeDebuffs
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
}
