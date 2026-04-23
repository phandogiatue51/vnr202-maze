import { isValidGrid } from './maze-generator';
import { Direction, Cell, Cord, CanvasOrNull, Ctx, OnUpdate, Gold, GameItem, ItemType, Debuff } from '../type';
import { hasDirection, ALL_DIRS_ARR } from './direction-util';
import {
  BORDER_COLOR,
  DEFAULT_PLAYER_COLOR,
  END_COLOR,
  GRID_PADDING,
  INDICATOR_COLOR,
  PLAYER_RADIUS_TO_CELL_RATIO,
  START_COLOR,
  VIEWPORT_SIZE
} from '../constants';
import { getContext } from './misc-util';

const TWO_PI = 2 * Math.PI;
const DEFAULT_STOKE_WIDTH = 10;
const PLAYER_STOKE_WIDTH = 4;
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function getOnUpdate(canvasManager: CanvasManager, delay = 50): OnUpdate {
  const cm = canvasManager;
  return async (grid: Cell[][], cord: Cord) => {
    cm.drawGrid(grid);
    cm.drawIndicatorSquare(cord);
    await sleep(delay);
  };
}

export default class CanvasManager {
  private canvas: CanvasOrNull;

  private ctx: Ctx;

  private width: number;

  private height: number;

  private padX = 0;

  private padY = 0;

  private gridSize = -1;

  private cellSize = -1;

  private playerRadius = -1;

  private offsetR = 0;

  private offsetC = 0;

  private goldImage: HTMLImageElement | null = null;
  private smokeBombImage: HTMLImageElement | null = null;
  private netImage: HTMLImageElement | null = null;
  private smokeEffectImage: HTMLImageElement | null = null;

  constructor(canvas: CanvasOrNull) {
    this.canvas = canvas;
    const context = getContext(this.canvas);
    this.ctx = context?.ctx as Ctx;
    this.width = context?.width || 0;
    this.height = context?.height || 0;
    this.goldImage = new Image();
    this.goldImage.src = '/gold.png';
    this.smokeBombImage = new Image();
    this.smokeBombImage.src = '/smoke-bomb.png';
    this.netImage = new Image();
    this.netImage.src = '/net.png';
    this.smokeEffectImage = new Image();
    this.smokeEffectImage.src = '/smoke-effect.png';
  }

  public refreshContext(): void {
    const context = getContext(this.canvas);
    this.ctx = context?.ctx as Ctx;
    this.width = context?.width || 0;
    this.height = context?.height || 0;
  }

  public clearCanvas = (): void => {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  };

  public drawGrid = (grid: Cell[][], playerLoc?: Cord): void => {
    if (!grid || !isValidGrid(grid)) throw new Error('Grid not valid');
    this.initDimension(this.width, this.height);
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Set wall drawing style
    this.ctx.strokeStyle = BORDER_COLOR;
    this.ctx.lineWidth = DEFAULT_STOKE_WIDTH;

    if (playerLoc) {
      const half = (VIEWPORT_SIZE - 1) / 2;
      this.offsetR = playerLoc.r - half;
      this.offsetC = playerLoc.c - half;
    } else {
      this.offsetR = 0;
      this.offsetC = 0;
    }

    const rStart = Math.max(0, Math.floor(this.offsetR));
    const rEnd = Math.min(grid.length - 1, Math.ceil(this.offsetR + VIEWPORT_SIZE));
    const cStart = Math.max(0, Math.floor(this.offsetC));
    const cEnd = Math.min(grid[0].length - 1, Math.ceil(this.offsetC + VIEWPORT_SIZE));

    for (let r = rStart; r <= rEnd; r++) {
      for (let c = cStart; c <= cEnd; c++) {
        this.drawCell(grid[r][c], { r, c });
      }
    }
  };

  public drawIndicatorSquare = (cord: Cord): void => {
    if (!this.ctx) return;
    this.ctx.fillStyle = INDICATOR_COLOR;
    this.drawSquare(cord);
    this.ctx.fill();
  };

  public drawStartFinish = (maze: number[][]): void => {
    this.ctx.fillStyle = START_COLOR;
    this.drawSquare({ r: 0, c: 0 });
    this.ctx.fill();
    this.ctx.fillStyle = END_COLOR;
    this.drawSquare({ r: maze.length - 1, c: maze.length - 1 });
    this.ctx.fill();
  };

  public drawGolds = (golds: Gold[]): void => {
    if (!this.goldImage) return;

    const isImageValid = this.goldImage.complete && this.goldImage.naturalWidth !== 0;

    golds.forEach((gold) => {
      if (!gold.collectedBy) {
        if (isImageValid && this.goldImage) {
          try {
            this.ctx.drawImage(
              this.goldImage,
              this.cCord(gold.location.c - 0.4),
              this.rCord(gold.location.r - 0.4),
              this.cellSize * 0.8,
              this.cellSize * 0.8
            );
          } catch (e) {
            this.drawGoldFallback(gold.location);
          }
        } else {
          this.drawGoldFallback(gold.location);
        }
      }
    });
  };

  public drawItems = (items: GameItem[]): void => {
    items.forEach((item) => {
      if (item.collectedBy) return;

      let img: HTMLImageElement | null = null;
      if (item.type === ItemType.SMOKE_BOMB) img = this.smokeBombImage;
      else if (item.type === ItemType.NET) img = this.netImage;

      if (img && img.complete && img.naturalWidth !== 0) {
        this.ctx.drawImage(
          img,
          this.cCord(item.location.c - 0.4),
          this.rCord(item.location.r - 0.4),
          this.cellSize * 0.8,
          this.cellSize * 0.8
        );
      }
    });
  };

  private drawGoldFallback = (cord: Cord): void => {
    const x = this.cCord(cord.c);
    const y = this.rCord(cord.r);
    const width = this.cellSize * 0.45;
    const height = this.cellSize * 0.65;
    const offset = width * 0.1;

    // Draw back document (darker, offset)
    this.ctx.fillStyle = '#1a2332';
    this.ctx.fillRect(x - width / 2 + offset, y - height / 2 + offset, width, height);

    // Draw front document (white)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x - width / 2, y - height / 2, width, height);
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - width / 2, y - height / 2, width, height);

    // Draw document lines on front
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    const lineX1 = x - width / 2 + 4;
    const lineX2 = x + width / 2 - 4;
    const lineY1 = y - height / 2 + height * 0.2;
    const lineY2 = y - height / 2 + height * 0.4;
    const lineY3 = y - height / 2 + height * 0.6;

    this.ctx.beginPath();
    this.ctx.moveTo(lineX1, lineY1);
    this.ctx.lineTo(lineX2, lineY1);
    this.ctx.moveTo(lineX1, lineY2);
    this.ctx.lineTo(lineX2, lineY2);
    this.ctx.moveTo(lineX1, lineY3);
    this.ctx.lineTo(lineX2, lineY3);
    this.ctx.stroke();

    // Draw fold corner on top-right (large and prominent)
    const foldWidth = width * 0.3;
    const foldHeight = height * 0.25;
    // Fill fold area with light gray
    this.ctx.fillStyle = '#e8e8e8';
    this.ctx.beginPath();
    this.ctx.moveTo(x + width / 2, y - height / 2);
    this.ctx.lineTo(x + width / 2 - foldWidth, y - height / 2);
    this.ctx.lineTo(x + width / 2, y - height / 2 + foldHeight);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw fold border and diagonal line
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(x + width / 2 - foldWidth, y - height / 2);
    this.ctx.lineTo(x + width / 2, y - height / 2);
    this.ctx.lineTo(x + width / 2, y - height / 2 + foldHeight);
    this.ctx.stroke();

    // Draw diagonal fold line
    this.ctx.beginPath();
    this.ctx.moveTo(x + width / 2 - foldWidth, y - height / 2);
    this.ctx.lineTo(x + width / 2, y - height / 2 + foldHeight);
    this.ctx.stroke();
  };

  public drawPlayer = (
    cord: Cord,
    color: string = DEFAULT_PLAYER_COLOR,
    playerLoc?: Cord,
    name?: string,
    debuffs?: Debuff[]
  ): void => {
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = PLAYER_STOKE_WIDTH;
    this.drawCircle(cord, this.playerRadius);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw active debuffs
    if (debuffs && debuffs.length > 0) {
      const now = Date.now();
      debuffs.forEach((debuff) => {
        if (now >= debuff.startTime && now <= debuff.endTime) {
          let effectImg: HTMLImageElement | null = null;
          if (debuff.type === ItemType.SMOKE_BOMB) effectImg = this.smokeEffectImage;
          else if (debuff.type === ItemType.NET) effectImg = this.netImage;

          if (effectImg && effectImg.complete && effectImg.naturalWidth !== 0) {
            this.ctx.drawImage(
              effectImg,
              this.cCord(cord.c - 0.5),
              this.rCord(cord.r - 0.5),
              this.cellSize,
              this.cellSize
            );
          }
        }
      });
    }

    if (name) {
      const fontSize = Math.max(10, Math.min(18, this.cellSize * 0.25));
      this.ctx.fillStyle = color;
      this.ctx.font = `bold ${fontSize}px Outfit, Inter, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.lineWidth = Math.max(2, fontSize * 0.18);
      this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
      const x = this.cCord(cord.c);
      const y = this.rCord(cord.r) - this.playerRadius - 4;
      this.ctx.strokeText(name, x, y);
      this.ctx.fillText(name, x, y);
    }
  };

  private initDimension = (width: number, height: number): void => {
    this.gridSize = Math.min(width, height) - 2 * GRID_PADDING;
    this.cellSize = this.gridSize / VIEWPORT_SIZE;
    this.playerRadius = this.cellSize * PLAYER_RADIUS_TO_CELL_RATIO;
    this.padY = (height - this.gridSize) / 2;
    this.padX = (width - this.gridSize) / 2;
  };

  private drawCircle = (cord: Cord, radius: number): void => {
    this.ctx.beginPath();
    const x = this.cCord(cord.c);
    const y = this.rCord(cord.r);
    this.ctx.arc(x, y, radius, 0, TWO_PI);
    this.ctx.closePath();
  };

  private drawSquare = (cord: Cord): void => {
    const { r, c } = cord;
    this.ctx.beginPath();
    this.ctx.moveTo(this.cCord(c) + 1, this.rCord(r) + 1);
    this.ctx.lineTo(this.cCord(c + 1) - 1, this.rCord(r) + 1);
    this.ctx.lineTo(this.cCord(c + 1) - 1, this.rCord(r + 1) - 1);
    this.ctx.lineTo(this.cCord(c) + 1, this.rCord(r + 1) - 1);
    this.ctx.closePath();
  };

  private rCord = (r: number) => {
    return this.padY + (r - this.offsetR) * this.cellSize;
  };

  private cCord = (c: number) => {
    return this.padX + (c - this.offsetC) * this.cellSize;
  };

  private drawBoundary = (): void => {
    if (this.gridSize > 0) {
      this.ctx.lineWidth = DEFAULT_STOKE_WIDTH;
      this.ctx.strokeStyle = BORDER_COLOR;
      this.ctx.beginPath();
      this.ctx.moveTo(this.padX, this.padY);
      this.ctx.lineTo(this.padX + this.gridSize, this.padY);
      this.ctx.lineTo(this.padX + this.gridSize, this.padY + this.gridSize);
      this.ctx.lineTo(this.padX, this.padY + this.gridSize);
      this.ctx.closePath();
      this.ctx.stroke();
    }
  };

  private drawCell = (cell: Cell, cord: Cord): void => {
    for (const dir of ALL_DIRS_ARR) {
      if (hasDirection(cell, dir)) {
        this.drawWall(cord, dir);
      }
    }
  };

  private drawWall = (cord: Cord, dir: Direction): void => {
    const { r, c } = cord;
    this.ctx.beginPath();
    if (dir === Direction.TOP || dir === Direction.LEFT)
      this.ctx.moveTo(this.cCord(c), this.rCord(r));
    else this.ctx.moveTo(this.cCord(c + 1), this.rCord(r + 1));
    if (dir === Direction.TOP || dir === Direction.RIGHT)
      this.ctx.lineTo(this.cCord(c + 1), this.rCord(r));
    else this.ctx.lineTo(this.cCord(c), this.rCord(r + 1));
    this.ctx.closePath();
    this.ctx.stroke();
  };

  public drawMinimap = (
    maze: Cell[][],
    golds: Gold[],
    players: { id: string; location: Cord }[],
    myId: string
  ): void => {
    if (!this.ctx || !maze || maze.length === 0) return;

    const minimapX = this.width - 180;
    const minimapY = this.height - 180;
    const minimapSize = 160;
    const cellPixelSize = minimapSize / maze.length;

    // Draw minimap background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(minimapX - 5, minimapY - 5, minimapSize + 10, minimapSize + 10);
    this.ctx.strokeStyle = '#FFB84D';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(minimapX - 5, minimapY - 5, minimapSize + 10, minimapSize + 10);

    // Draw maze grid
    this.ctx.strokeStyle = '#444444';
    this.ctx.lineWidth = 0.5;
    for (let r = 0; r < maze.length; r++) {
      for (let c = 0; c < maze[r].length; c++) {
        const x = minimapX + c * cellPixelSize;
        const y = minimapY + r * cellPixelSize;
        const cell = maze[r][c];

        // Draw walls
        if (hasDirection(cell, Direction.TOP)) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x + cellPixelSize, y);
          this.ctx.stroke();
        }
        if (hasDirection(cell, Direction.LEFT)) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x, y + cellPixelSize);
          this.ctx.stroke();
        }
      }
    }

    // Draw golds (uncollected ones)
    golds.forEach((gold) => {
      if (!gold.collectedBy) {
        const x = minimapX + gold.location.c * cellPixelSize + cellPixelSize / 2;
        const y = minimapY + gold.location.r * cellPixelSize + cellPixelSize / 2;
        this.ctx.fillStyle = '#FFA500';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, TWO_PI);
        this.ctx.fill();
      }
    });

    // Draw players
    players.forEach((player) => {
      const x = minimapX + player.location.c * cellPixelSize + cellPixelSize / 2;
      const y = minimapY + player.location.r * cellPixelSize + cellPixelSize / 2;

      if (player.id === myId) {
        // Highlight current player with cyan circle
        this.ctx.fillStyle = '#00FF00';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, TWO_PI);
        this.ctx.fill();
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      } else {
        // Other players
        this.ctx.fillStyle = '#00CC00';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2.5, 0, TWO_PI);
        this.ctx.fill();
      }
    });
  };
}
