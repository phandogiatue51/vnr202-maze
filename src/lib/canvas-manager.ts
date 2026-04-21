import { isValidGrid } from './maze-generator';
import { Direction, Cell, Cord, CanvasOrNull, Ctx, OnUpdate, Gold } from '../type';
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
const DEFAULT_STOKE_WIDTH = 1;
const PLAYER_STOKE_WIDTH = 2;
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

  constructor(canvas: CanvasOrNull) {
    this.canvas = canvas;
    const context = getContext(this.canvas);
    this.ctx = context?.ctx as Ctx;
    this.width = context?.width || 0;
    this.height = context?.height || 0;
    this.goldImage = new Image();
    this.goldImage.src = '/gold.png';
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

  private drawGoldFallback = (cord: Cord): void => {
    this.ctx.fillStyle = '#FBBF24'; // Warning color (Yellow)
    this.ctx.beginPath();
    const x = this.cCord(cord.c);
    const y = this.rCord(cord.r);
    this.ctx.arc(x, y, this.cellSize * 0.3, 0, TWO_PI);
    this.ctx.fill();
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.closePath();
  };

  public drawPlayer = (
    cord: Cord,
    color: string = DEFAULT_PLAYER_COLOR,
    playerLoc?: Cord,
    name?: string
  ): void => {
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = PLAYER_STOKE_WIDTH;
    this.drawCircle(cord, this.playerRadius);
    this.ctx.fill();
    this.ctx.stroke();

    if (name) {
      const fontSize = Math.max(10, Math.min(18, this.cellSize * 0.25));
      this.ctx.fillStyle = 'white';
      this.ctx.font = `bold ${fontSize}px Outfit, Inter, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 4;
      const x = this.cCord(cord.c);
      const y = this.rCord(cord.r) - this.playerRadius - 4;
      this.ctx.fillText(name, x, y);
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
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
}
