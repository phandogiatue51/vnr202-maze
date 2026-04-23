import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';
import { FIREBASE_CONFIG, MAZE_SIZE } from '../constants';
import {
  CallBack,
  CanvasOrNull,
  Control,
  Cord,
  Gold,
  ItemType,
  MapItem,
  Player,
  PlayerEffects
} from '../type';
import Game from './game';
import { generateGold } from './gold-logic';
import {
  createDefaultEffects,
  createDefaultInventory,
  generateMapItems,
  isEffectActive
} from './item-logic';

const REFRESH_THRESHOLD = 3;
const ROUND_DURATION_SECONDS = 600;
const TARGETED_ITEMS: ItemType[] = ['boom', 'flash', 'net', 'smoke'];
const EFFECT_DURATION = {
  banana: 10000,
  net: 5000,
  smoke: 5000,
  flash: 2000,
  torch: 10000,
  boom: 900,
  shieldPulse: 900
} as const;

type Auth = firebase.auth.Auth;
type Database = firebase.database.Database;
type Reference = firebase.database.Reference;

type UseItemResult = {
  ok: boolean;
  message: string;
};

type RoomDoc = {
  startedAt?: number | null;
  status?: 'waiting' | 'started';
  golds?: Record<string, Gold>;
  items?: Record<string, MapItem>;
};

export default class MultiplayerGame {
  private isWinner: boolean;

  private myUID?: string;

  private lastUpdatedPosition?: Cord;

  private opPositions: Map<string, Cord>;

  private unsubscribePlayers?: () => void;

  private unsubscribeGolds?: () => void;

  private unsubscribeItems?: () => void;

  private counter = 0;

  private golds: Gold[] = [];

  private items: MapItem[] = [];

  private players: Map<string, Player> = new Map();

  private isEntered = false;

  private playerName?: string;

  private game!: Game;

  private canvas: CanvasOrNull;

  private database!: Database;

  private roomCode = '';

  private playersRef?: Reference;

  private goldsRef?: Reference;

  private itemsRef?: Reference;

  private onGameOver?: CallBack;

  private callBack?: CallBack;

  private onGoldHit?: (gold: Gold) => void;

  private onGoldCollected?: (goldId: string, collectedBy: string) => void;

  private onTimerUpdate?: (secondsLeft: number) => void;

  private onStatusUpdate?: (status: 'waiting' | 'started') => void;

  private onPlayersUpdate?: (players: Player[]) => void;

  private isFirebaseReady = false;

  private timerInterval?: number;

  private secondsLeft = ROUND_DURATION_SECONDS;

  private startTime?: number;

  private roomRef?: Reference;

  constructor(
    canvas: CanvasOrNull,
    onGameOver?: CallBack,
    callBack?: CallBack,
    onGoldHit?: (gold: Gold) => void,
    onGoldCollected?: (goldId: string, collectedBy: string) => void,
    onTimerUpdate?: (secondsLeft: number) => void,
    onStatusUpdate?: (status: 'waiting' | 'started') => void,
    onPlayersUpdate?: (players: Player[]) => void
  ) {
    this.canvas = canvas;
    this.isWinner = false;
    this.opPositions = new Map();
    this.onGameOver = onGameOver;
    this.callBack = callBack;
    this.onGoldHit = onGoldHit;
    this.onGoldCollected = onGoldCollected;
    this.onTimerUpdate = onTimerUpdate;
    this.onStatusUpdate = onStatusUpdate;
    this.onPlayersUpdate = onPlayersUpdate;
    try {
      this.initFirebaseService();
      this.isFirebaseReady = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to initialize multiplayer services. Please check Firebase settings.';
      if (this.callBack) {
        this.callBack(false, message);
      }
      this.initNewGame(12345);
      this.startLocalTimer(Date.now() + ROUND_DURATION_SECONDS * 1000);
      console.error('Multiplayer initialization failed:', error);
    }
  }

  public performMove = (control: Control): void => {
    if (!this.game) return;

    const adjustedControl = this.getAdjustedControl(control);
    if (adjustedControl.magnitude === 0) return;

    this.counter++;
    this.game.performMove(adjustedControl);
    if (this.counter >= REFRESH_THRESHOLD) {
      this.updateMyLocation();
      this.counter = 0;
    }
    if (this.game.checkWin() && !this.isWinner) {
      this.isWinner = true;
      if (this.myUID) {
        this.getPlayersRef().child(this.myUID).update({
          finishTime: Date.now(),
          reachedGoal: true
        });
      }
      if (this.onGameOver) this.onGameOver(true);
    }
  };

  public render = (): void => {
    if (!this.canvas || !this.game) return;
    this.syncViewportFromEffects();
    this.game.renderGame();
  };

  public renderMinimap = (): void => {
    if (!this.game) return;
    const maze = this.game.getMaze();
    const golds = this.game.getGoldItems();
    const canvasManager = this.game.getCanvasManager();
    const players = this.getPlayers();
    const myId = this.myUID;
    if (myId) {
      canvasManager.drawMinimap(maze, golds, players, myId);
    }
  };

  public setCanvas = (canvas: CanvasOrNull): void => {
    this.canvas = canvas;
    if (this.game) this.game.setCanvas(canvas);
  };

  public getPlayers = (): Player[] => {
    return Array.from(this.players.values());
  };

  public getMyPlayerId = (): string | undefined => {
    return this.myUID;
  };

  public getMyPlayer = (): Player | undefined => {
    if (!this.myUID) return undefined;
    return this.players.get(this.myUID);
  };

  public getDB = (): Database => {
    return this.database;
  };

  public startGame = async (): Promise<void> => {
    if (!this.isFirebaseReady || !this.myUID) return;
    const now = Date.now();
    this.startTime = now;
    this.secondsLeft = ROUND_DURATION_SECONDS;

    await this.getPlayersRef().child(this.myUID).update({
      startTime: now,
      finishTime: null,
      reachedGoal: false,
      goldCount: 0,
      shieldCount: 0,
      inventory: createDefaultInventory(),
      effects: createDefaultEffects(),
      r: 0.5,
      c: 0.5
    });

    this.startLocalTimer(now + ROUND_DURATION_SECONDS * 1000);
    this.initNewGame(12345);
  };

  public purgePlayers = async (): Promise<void> => {
    if (!this.isFirebaseReady) return;
    await this.getPlayersRef().remove();
  };

  public collectGold = async (gold: Gold): Promise<boolean> => {
    if (!this.isFirebaseReady || !this.myUID) {
      const localGold = this.golds.find((g) => g.id === gold.id);
      if (!localGold || localGold.collectedBy) return false;
      localGold.collectedBy = 'local-player';
      if (this.game) this.game.setGoldItems(this.golds);
      return true;
    }

    const goldRef = this.getGoldsRef().child(gold.id);
    const playerRef = this.getPlayersRef().child(this.myUID);

    try {
      const result = await goldRef.transaction((currentGoldData: any) => {
        if (currentGoldData && currentGoldData.collectedBy) {
          return undefined;
        }
        return {
          ...gold,
          collectedBy: this.myUID,
          collectedAt: Date.now()
        };
      });

      if (result.committed) {
        await playerRef.child('goldCount').transaction((currentCount: number | null) => {
          return (currentCount || 0) + 1;
        });

        const goldItem = this.golds.find((g) => g.id === gold.id);
        if (goldItem) {
          goldItem.collectedBy = this.myUID;
          if (this.game) this.game.setGoldItems(this.golds);
        }
        return true;
      }
    } catch (e) {
      console.error('Collect gold transaction failed:', e);
    }

    return false;
  };

  public useInventoryItem = async (
    type: Exclude<ItemType, 'banana'>,
    targetId?: string
  ): Promise<UseItemResult> => {
    if (!this.isFirebaseReady || !this.myUID) {
      return { ok: false, message: 'Phòng chơi chưa sẵn sàng.' };
    }

    if (TARGETED_ITEMS.includes(type) && !targetId) {
      return { ok: false, message: 'Hãy chọn người chơi bị tác động.' };
    }

    const myPlayerRef = this.getPlayersRef().child(this.myUID);
    const inventoryResult = await myPlayerRef
      .child(`inventory/${type}`)
      .transaction((currentCount: number | null) => {
        if ((currentCount || 0) <= 0) {
          return undefined;
        }
        return (currentCount || 0) - 1;
      });

    if (!inventoryResult.committed) {
      return { ok: false, message: 'Bạn không còn vật phẩm này.' };
    }

    if (type === 'shield') {
      await myPlayerRef.transaction((playerData: any) => {
        if (!playerData) return playerData;
        return {
          ...playerData,
          shieldCount: (playerData.shieldCount || 0) + 1,
          effects: {
            ...createDefaultEffects(),
            ...(playerData.effects || {}),
            shieldPulseUntil: Date.now() + EFFECT_DURATION.shieldPulse
          }
        };
      });
      return { ok: true, message: 'Đã kích hoạt khiên. Khiên sẽ chặn 1 hiệu ứng kế tiếp.' };
    }

    if (type === 'torch') {
      await myPlayerRef.child('effects').update({
        torchUntil: Date.now() + EFFECT_DURATION.torch
      });
      return { ok: true, message: 'Đuốc đã bật, đường đến đích sẽ hiện trong 10 giây.' };
    }

    if (!targetId) {
      return { ok: false, message: 'Thiếu mục tiêu.' };
    }

    const applied = await this.applyItemEffectToPlayer(targetId, type);
    return applied
      ? { ok: true, message: 'Đã dùng vật phẩm lên mục tiêu.' }
      : { ok: false, message: 'Không thể áp dụng vật phẩm này.' };
  };

  public enterGame = (name: string): void => {
    if (!this.isFirebaseReady) {
      const me = this.game?.getMyPlayer();
      if (me) me.name = name;
      return;
    }
    this.isEntered = true;
    this.playerName = name;
    if (this.myUID) {
      this.syncPlayer();
    }
  };

  public cleanUp = (): void => {
    if (this.unsubscribePlayers) {
      this.unsubscribePlayers();
    }
    if (this.unsubscribeGolds) {
      this.unsubscribeGolds();
    }
    if (this.unsubscribeItems) {
      this.unsubscribeItems();
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  };

  private initFirebaseService = () => {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.appId) {
      throw new Error(
        'Firebase config is missing. Please set REACT_APP_FIREBASE_* variables.'
      );
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    const app = firebase.app();
    this.database = app.database();
    this.roomCode = localStorage.getItem('roomCode') || '';
    if (!this.roomCode) {
      throw new Error('Room code is missing. Please rejoin the lobby.');
    }

    const roomRef = this.database.ref(`rooms/${this.roomCode}`);
    this.roomRef = roomRef;
    this.playersRef = roomRef.child('players');
    this.goldsRef = roomRef.child('golds');
    this.itemsRef = roomRef.child('items');
    const auth = app.auth();
    this.signInAndInitListener(auth);
  };

  private getPlayersRef = (): Reference => {
    if (!this.playersRef) {
      throw new Error('Players reference is not initialized.');
    }
    return this.playersRef;
  };

  private getGoldsRef = (): Reference => {
    if (!this.goldsRef) {
      throw new Error('Golds reference is not initialized.');
    }
    return this.goldsRef;
  };

  private getItemsRef = (): Reference => {
    if (!this.itemsRef) {
      throw new Error('Items reference is not initialized.');
    }
    return this.itemsRef;
  };

  private signInAndInitListener = (auth: Auth) => {
    auth.signInAnonymously().catch((error: Error) => {
      console.error('Firebase Auth Error:', error);
      if (this.callBack) {
        this.callBack(false, `Đăng nhập thất bại: ${error.message || 'Lỗi không xác định'}`);
      }
    });
    auth.onAuthStateChanged((user: firebase.User | null) => {
      if (user) {
        if (this.callBack) this.callBack(true, 'Đăng nhập thành công.');
        this.myUID = user.uid;
        if (this.isEntered) this.syncPlayer();
        this.addPlayersListener();

        if (this.onPlayersUpdate) {
          this.onPlayersUpdate(this.getPlayers());
        }
      }
    });
  };

  private syncPlayer = async () => {
    if (!this.isFirebaseReady) return;
    const name = this.playerName || localStorage.getItem('playerName') || 'Anonymous';
    if (!this.myUID) return;

    const playerRef = this.getPlayersRef().child(this.myUID);
    const myPlayer = this.game?.getMyPlayer();
    const fallbackLocation = myPlayer?.location || { r: 0.5, c: 0.5 };
    let resolvedLocation: Cord = fallbackLocation;

    try {
      const snapshot = await playerRef.once('value');
      const roomSnapshot = await this.roomRef?.once('value');
      const roomData = (roomSnapshot?.val() || {}) as RoomDoc;
      const now = Date.now();
      const sharedStartTime = roomData.startedAt || null;

      if (!snapshot.exists()) {
        this.startTime = sharedStartTime || now;
        resolvedLocation = fallbackLocation;
        await playerRef.set({
          name,
          ...resolvedLocation,
          goldCount: 0,
          shieldCount: 0,
          inventory: createDefaultInventory(),
          effects: createDefaultEffects(),
          reachedGoal: false,
          joinedAt: now,
          startTime: this.startTime,
          finishTime: null,
          connected: true,
          lastSeen: null
        });

        playerRef.onDisconnect().update({
          connected: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        this.startLocalTimer((this.startTime || now) + ROUND_DURATION_SECONDS * 1000);
      } else {
        const data = snapshot.val();
        const previousStartTime = data?.startTime || sharedStartTime;
        const isPreviousGameFinished = data?.finishTime !== null && data?.finishTime !== undefined;
        const isTimeExpired =
          typeof previousStartTime === 'number' &&
          now - previousStartTime >= ROUND_DURATION_SECONDS * 1000;

        if (isPreviousGameFinished || isTimeExpired || !previousStartTime) {
          this.startTime = sharedStartTime || now;
          resolvedLocation = { r: 0.5, c: 0.5 };
          await playerRef.update({
            name,
            r: resolvedLocation.r,
            c: resolvedLocation.c,
            startTime: this.startTime,
            finishTime: null,
            reachedGoal: false,
            goldCount: 0,
            shieldCount: 0,
            inventory: createDefaultInventory(),
            effects: createDefaultEffects(),
            connected: true,
            lastSeen: null
          });
        } else {
          this.startTime = previousStartTime;
          resolvedLocation = {
            r: data?.r ?? fallbackLocation.r,
            c: data?.c ?? fallbackLocation.c
          };
          await playerRef.update({
            name,
            r: resolvedLocation.r,
            c: resolvedLocation.c,
            inventory: {
              ...createDefaultInventory(),
              ...(data?.inventory || {})
            },
            effects: {
              ...createDefaultEffects(),
              ...(data?.effects || {})
            },
            shieldCount: data?.shieldCount || 0,
            goldCount: data?.goldCount || 0,
            finishTime: data?.finishTime ?? null,
            reachedGoal: Boolean(data?.reachedGoal),
            startTime: previousStartTime,
            connected: true,
            lastSeen: null
          });
        }

        playerRef.onDisconnect().update({
          connected: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        this.startLocalTimer((this.startTime || now) + ROUND_DURATION_SECONDS * 1000);
      }
      this.initNewGame(12345);
      this.game?.setMyPlayerLocation(resolvedLocation);
      this.addGoldsListener();
      this.addItemsListener();
    } catch (e) {
      console.error('Sync player failed:', e);
    }
  };

  private addGoldsListener = (): void => {
    if (!this.isFirebaseReady) return;
    if (this.unsubscribeGolds) {
      this.unsubscribeGolds();
    }

    const listener = (snapshot: firebase.database.DataSnapshot) => {
      const goldsData = snapshot.val() || {};
      const remoteGolds = Object.values(goldsData) as Gold[];
      if (remoteGolds.length > 0) {
        remoteGolds.forEach((gold) => {
          const previousGold = this.golds.find((item) => item.id === gold.id);
          if (!previousGold?.collectedBy && gold.collectedBy && this.onGoldCollected) {
            this.onGoldCollected(gold.id, gold.collectedBy);
          }
        });
        this.golds = remoteGolds;
      }

      if (this.game) {
        this.game.setGoldItems(this.golds);
      }
    };

    this.getGoldsRef().on('value', listener);
    this.unsubscribeGolds = () => this.getGoldsRef().off('value', listener);
  };

  private addItemsListener = (): void => {
    if (!this.isFirebaseReady) return;
    if (this.unsubscribeItems) {
      this.unsubscribeItems();
    }

    const listener = (snapshot: firebase.database.DataSnapshot) => {
      const itemsData = snapshot.val() || {};
      const remoteItems = Object.values(itemsData) as MapItem[];
      if (remoteItems.length > 0) {
        this.items = remoteItems;
      }

      if (this.game) {
        this.game.setMapItems(this.items);
      }
    };

    this.getItemsRef().on('value', listener);
    this.unsubscribeItems = () => this.getItemsRef().off('value', listener);
  };

  private addPlayersListener = (): void => {
    if (!this.isFirebaseReady) return;

    const listener = (snapshot: firebase.database.DataSnapshot) => {
      this.players.clear();
      this.opPositions.clear();

      const playersData = snapshot.val() || {};
      Object.keys(playersData).forEach((id) => {
        const p = playersData[id];
        if (p.connected === false) {
          return;
        }
        const player: Player = {
          id,
          location: { r: p.r || 0, c: p.c || 0 },
          name: p.name,
          goldCount: p.goldCount || 0,
          shieldCount: p.shieldCount || 0,
          inventory: {
            ...createDefaultInventory(),
            ...(p.inventory || {})
          },
          effects: {
            ...createDefaultEffects(),
            ...(p.effects || {})
          },
          finishTime: p.finishTime,
          reachedGoal: Boolean(p.reachedGoal),
          joinedAt: p.joinedAt,
          startTime: p.startTime,
          connected: p.connected !== false,
          lastSeen: p.lastSeen
        };

        this.players.set(id, player);
        if (id !== this.myUID) {
          this.opPositions.set(id, player.location);
        } else if (this.game) {
          const localPlayer = this.game.getMyPlayer();
          localPlayer.name = player.name;
        }
      });

      if (this.onPlayersUpdate) {
        this.onPlayersUpdate(this.getPlayers());
      }

      if (this.canvas) {
        this.game?.setOpponentsPos(this.opPositions);
        this.game?.setPlayersMap(this.players);
      }
    };

    this.getPlayersRef().on('value', listener);
    this.unsubscribePlayers = () => this.getPlayersRef().off('value', listener);
  };

  public removePlayerExplicitly = async (): Promise<void> => {
    if (this.isFirebaseReady && this.myUID) {
      await this.getPlayersRef().child(this.myUID).remove();
    }
  };

  private updateMyLocation = (): void => {
    if (!this.isFirebaseReady) return;
    const myPlayer = this.game?.getMyPlayer();
    if (!myPlayer || !this.myUID) return;
    const newPos = myPlayer.location;
    const oldPos = this.lastUpdatedPosition;
    if (!oldPos || newPos.c !== oldPos.c || newPos.r !== oldPos.r) {
      this.getPlayersRef().child(this.myUID).update(newPos);
      this.lastUpdatedPosition = newPos;
    }
  };

  private initNewGame = (seed: number) => {
    const size = MAZE_SIZE;
    this.golds = generateGold(size, seed);
    this.items = generateMapItems(size, seed);

    this.game = new Game(
      this.canvas,
      size,
      seed,
      this.myUID,
      (gold) => {
        if (this.onGoldHit && !gold.collectedBy) {
          this.onGoldHit(gold);
        }
      },
      (item) => {
        void this.handleMapItemCollision(item);
      }
    );

    if (this.canvas) {
      this.game.setOpponentsPos(this.opPositions);
      this.game.setGoldItems(this.golds);
      this.game.setMapItems(this.items);
      this.game.setPlayersMap(this.players);
    }
    this.isWinner = false;
    this.syncViewportFromEffects();
  };

  private startLocalTimer = (endTime: number) => {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const update = async () => {
      const now = Date.now();
      const secondsLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      this.secondsLeft = secondsLeft;
      if (this.onTimerUpdate) this.onTimerUpdate(secondsLeft);

      if (secondsLeft <= 0) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        if (!this.isWinner) {
          if (this.onGameOver) this.onGameOver(false);
        }
      }
    };

    update();
    this.timerInterval = window.setInterval(update, 1000);
  };

  private getAdjustedControl = (control: Control): Control => {
    const myPlayer = this.getMyPlayer();
    const effects = myPlayer?.effects;
    if (isEffectActive(effects?.rootedUntil)) {
      return { ...control, magnitude: 0 };
    }
    if (isEffectActive(effects?.reversedUntil) && control.magnitude > 0) {
      return {
        ...control,
        angle: control.angle + Math.PI
      };
    }
    return control;
  };

  private syncViewportFromEffects = (): void => {
    this.game?.setViewportSize(3);
  };

  private handleMapItemCollision = async (item: MapItem): Promise<void> => {
    if (!this.myUID) return;
    if (item.type === 'banana') {
      await this.consumeBananaTrap(item);
      return;
    }

    await this.collectMapItem(item);
  };

  private collectMapItem = async (item: MapItem): Promise<void> => {
    if (!this.isFirebaseReady || !this.myUID) return;

    const itemRef = this.getItemsRef().child(item.id);
    const result = await itemRef.transaction((currentItem: any) => {
      if (currentItem?.collectedBy || currentItem?.consumedBy) {
        return undefined;
      }
      return {
        ...item,
        collectedBy: this.myUID,
        collectedAt: Date.now()
      };
    });

    if (!result.committed) return;

    if (item.type === 'torch') {
      await this.getPlayersRef()
        .child(this.myUID)
        .child('effects')
        .update({ torchUntil: Date.now() + EFFECT_DURATION.torch });
      if (this.callBack) {
        this.callBack(true, 'Đã nhặt đuốc. Hãy đi theo đường line vàng trong 10 giây.');
      }
      return;
    }

    if (item.type === 'shield') {
      await this.getPlayersRef().child(this.myUID).transaction((playerData: any) => {
        if (!playerData) return playerData;
        return {
          ...playerData,
          shieldCount: (playerData.shieldCount || 0) + 1,
          effects: {
            ...createDefaultEffects(),
            ...(playerData.effects || {}),
            shieldPulseUntil: Date.now() + EFFECT_DURATION.shieldPulse
          }
        };
      });
      if (this.callBack) {
        this.callBack(true, 'Đã nhặt khiên. Khiên được kích hoạt ngay và sẽ chặn 1 hiệu ứng kế tiếp.');
      }
      return;
    }

    await this.getPlayersRef()
      .child(this.myUID)
      .child(`inventory/${item.type}`)
      .transaction((currentCount: number | null) => {
        return (currentCount || 0) + 1;
      });
  };

  private consumeBananaTrap = async (item: MapItem): Promise<void> => {
    if (!this.isFirebaseReady || !this.myUID) return;

    const itemRef = this.getItemsRef().child(item.id);
    const result = await itemRef.transaction((currentItem: any) => {
      if (currentItem?.collectedBy || currentItem?.consumedBy) {
        return undefined;
      }
      return {
        ...item,
        consumedBy: this.myUID,
        consumedAt: Date.now()
      };
    });

    if (!result.committed) return;
    await this.applyItemEffectToPlayer(this.myUID, 'banana');
  };

  private applyItemEffectToPlayer = async (targetId: string, type: ItemType): Promise<boolean> => {
    if (!this.isFirebaseReady) return false;

    const targetRef = this.getPlayersRef().child(targetId);
    const now = Date.now();
    const result = await targetRef.transaction((playerData: any) => {
      if (!playerData) return playerData;

      const shieldCount = playerData.shieldCount || 0;
      const effects: PlayerEffects = {
        ...createDefaultEffects(),
        ...(playerData.effects || {})
      };

      if (type !== 'torch' && type !== 'shield' && shieldCount > 0) {
        return {
          ...playerData,
          shieldCount: shieldCount - 1,
          effects: {
            ...effects,
            shieldPulseUntil: now + EFFECT_DURATION.shieldPulse
          }
        };
      }

      if (type === 'banana') {
        effects.reversedUntil = now + EFFECT_DURATION.banana;
      }

      if (type === 'net') {
        effects.rootedUntil = now + EFFECT_DURATION.net;
      }

      if (type === 'smoke') {
        effects.smokedUntil = now + EFFECT_DURATION.smoke;
      }

      if (type === 'flash') {
        effects.flashedUntil = now + EFFECT_DURATION.flash;
      }

      if (type === 'boom') {
        effects.explosionUntil = now + EFFECT_DURATION.boom;
      }

      return {
        ...playerData,
        goldCount:
          type === 'boom' ? Math.max(0, (playerData.goldCount || 0) - 1) : playerData.goldCount || 0,
        effects
      };
    });

    return Boolean(result.committed);
  };
}
