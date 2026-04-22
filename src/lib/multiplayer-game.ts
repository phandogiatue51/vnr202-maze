import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import { FIREBASE_CONFIG, MAZE_SIZE } from '../constants';
import { CallBack, CanvasOrNull, Control, Cord, Player, Gold } from '../type';
import Game from './game';
import { generateGold } from './gold-logic';

const REFRESH_THRESHOLD = 3;
const ROUND_DURATION_SECONDS = 600;

type Auth = firebase.auth.Auth;
type Firestore = firebase.firestore.Firestore;
type CollectionReference = firebase.firestore.CollectionReference;

export default class MultiplayerGame {
  private isWinner: boolean;

  private myUID?: string;

  private lastUpdatedPosition?: Cord;

  private opPositions: Map<string, Cord>;

  private unsubscribePlayers?: () => void;

  private unsubscribeGolds?: () => void;

  private counter = 0;

  private golds: Gold[] = [];

  private players: Map<string, Player> = new Map();

  private isEntered = false;

  private playerName?: string;

  private game!: Game;

  private canvas: CanvasOrNull;

  private firestore!: Firestore;

  private roomCode = '';

  private playersRef?: CollectionReference;

  private goldsRef?: CollectionReference;

  private onGameOver?: CallBack;

  private callBack?: CallBack;

  private onGoldHit?: (gold: Gold) => void;

  private onGoldCollected?: (goldId: string, collectedBy: string) => void;

  private onTimerUpdate?: (secondsLeft: number) => void;

  private onStatusUpdate?: (status: 'waiting' | 'started') => void;

  private onPlayersUpdate?: (players: Player[]) => void;

  private isFirebaseReady = false;

  private timerInterval?: NodeJS.Timeout;

  private secondsLeft = ROUND_DURATION_SECONDS;

  private startTime?: number;

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
    this.counter++;
    this.game.performMove(control);
    if (this.counter >= REFRESH_THRESHOLD) {
      this.updateMyLocation();
      this.counter = 0;
    }
    if (this.game.checkWin() && !this.isWinner) {
      this.isWinner = true;
      if (this.myUID) {
        this.getPlayersRef().doc(this.myUID).update({
          finishTime: Date.now(),
          reachedGoal: true
        });
      }
      if (this.onGameOver) this.onGameOver(true);
    }
  };

  public render = (): void => {
    if (this.canvas) this.game?.renderGame();
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

  public getDB = (): Firestore => {
    return this.firestore;
  };

  public startGame = async (): Promise<void> => {
    if (!this.isFirebaseReady || !this.myUID) return;
    const now = Date.now();
    this.startTime = now;
    this.secondsLeft = ROUND_DURATION_SECONDS;

    await this.getPlayersRef().doc(this.myUID).update({
      startTime: now,
      finishTime: null,
      reachedGoal: false,
      goldCount: 0,
      r: 0.5,
      c: 0.5
    });

    this.startLocalTimer(now + ROUND_DURATION_SECONDS * 1000);
    this.initNewGame(12345);
  };

  public purgePlayers = async (): Promise<void> => {
    if (!this.isFirebaseReady) return;
    const snapshot = await this.getPlayersRef().get();
    const batch = this.firestore.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  };

  public collectGold = async (gold: Gold): Promise<boolean> => {
    if (!this.isFirebaseReady || !this.myUID) {
      const localGold = this.golds.find((g) => g.id === gold.id);
      if (!localGold || localGold.collectedBy) return false;
      localGold.collectedBy = 'local-player';
      if (this.game) this.game.setGoldItems(this.golds);
      return true;
    }

    const playerRef = this.getPlayersRef().doc(this.myUID);
    const goldRef = this.getGoldsRef().doc(gold.id);

    const collected = await this.firestore.runTransaction(async (transaction) => {
      const goldDoc = await transaction.get(goldRef);
      const goldData = goldDoc.data();
      if (goldData?.collectedBy) {
        return false;
      }

      const playerDoc = await transaction.get(playerRef);
      const currentGold = playerDoc.data()?.goldCount || 0;

      transaction.set(
        goldRef,
        {
          collectedBy: this.myUID,
          collectedAt: Date.now()
        },
        { merge: true }
      );

      if (playerDoc.exists) {
        transaction.update(playerRef, { goldCount: currentGold + 1 });
      } else {
        transaction.set(playerRef, { goldCount: 1 }, { merge: true });
      }

      return true;
    });

    if (collected) {
      const goldItem = this.golds.find((g) => g.id === gold.id);
      if (goldItem) {
        goldItem.collectedBy = this.myUID;
        if (this.game) this.game.setGoldItems(this.golds);
      }
    }

    return collected;
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
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  };

  private initFirebaseService = () => {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.appId) {
      throw new Error(
        'Firebase config is missing. Please set REACT_APP_FIREBASE_* (or REACT_APP_firebase_*) variables.'
      );
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    const app = firebase.app();
    this.firestore = app.firestore();
    this.roomCode = localStorage.getItem('roomCode') || '';
    if (!this.roomCode) {
      throw new Error('Room code is missing. Please rejoin the lobby.');
    }
    const roomRef = this.firestore.collection('rooms').doc(this.roomCode);
    this.playersRef = roomRef.collection('players');
    this.goldsRef = roomRef.collection('golds');
    const auth = app.auth();
    this.signInAndInitListener(auth);
  };

  private getPlayersRef = (): CollectionReference => {
    if (!this.playersRef) {
      throw new Error('Players collection is not initialized.');
    }
    return this.playersRef;
  };

  private getGoldsRef = (): CollectionReference => {
    if (!this.goldsRef) {
      throw new Error('Golds collection is not initialized.');
    }
    return this.goldsRef;
  };

  private signInAndInitListener = (auth: Auth) => {
    auth.signInAnonymously().catch((error) => {
      console.error('Firebase Auth Error:', error);
      if (this.callBack) {
        this.callBack(false, `Đăng nhập thất bại: ${error.message || 'Lỗi không xác định'}`);
      }
    });
    auth.onAuthStateChanged((user) => {
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

    const playerRef = this.getPlayersRef().doc(this.myUID);
    const myPlayer = this.game?.getMyPlayer();
    const location = myPlayer?.location || { r: 0.5, c: 0.5 };

    try {
      const doc = await playerRef.get();
      const now = Date.now();

      if (!doc.exists) {
        this.startTime = now;
        await playerRef.set({
          name,
          ...location,
          goldCount: 0,
          reachedGoal: false,
          joinedAt: now,
          startTime: now,
          finishTime: null
        });
        this.startLocalTimer(now + ROUND_DURATION_SECONDS * 1000);
      } else {
        const data = doc.data();
        const previousStartTime = data?.startTime;
        const isPreviousGameFinished = data?.finishTime !== null && data?.finishTime !== undefined;
        const isTimeExpired =
          typeof previousStartTime === 'number' &&
          now - previousStartTime >= ROUND_DURATION_SECONDS * 1000;

        if (isPreviousGameFinished || isTimeExpired || !previousStartTime) {
          this.startTime = now;
          await playerRef.update({
            name,
            ...location,
            startTime: now,
            finishTime: null,
            reachedGoal: false,
            goldCount: 0
          });
        } else {
          this.startTime = previousStartTime;
          await playerRef.update({
            name,
            ...location
          });
        }
        this.startLocalTimer((this.startTime || now) + ROUND_DURATION_SECONDS * 1000);
      }
      this.initNewGame(12345);
      this.addGoldsListener();
    } catch (e) {
      console.error('Sync player failed:', e);
    }
  };

  private addGoldsListener = (): void => {
    if (!this.isFirebaseReady) return;
    if (this.unsubscribeGolds) {
      this.unsubscribeGolds();
    }

    this.unsubscribeGolds = this.getGoldsRef().onSnapshot((snapshot) => {
      const goldOwners = new Map<string, string | null>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        goldOwners.set(doc.id, data?.collectedBy || null);
      });

      this.golds = this.golds.map((gold) => {
        const nextCollectedBy = goldOwners.get(gold.id) || null;
        if (!gold.collectedBy && nextCollectedBy && this.onGoldCollected) {
          this.onGoldCollected(gold.id, nextCollectedBy);
        }

        return {
          ...gold,
          collectedBy: nextCollectedBy
        };
      });

      if (this.game) {
        this.game.setGoldItems(this.golds);
      }
    });
  };

  private addPlayersListener = (): void => {
    if (!this.isFirebaseReady) return;
    this.unsubscribePlayers = this.getPlayersRef().onSnapshot((snapshot) => {
      this.players.clear();
      this.opPositions.clear();

      snapshot.forEach((doc) => {
        const { id } = doc;
        const p = doc.data();

        const player: Player = {
          id,
          location: { r: p.r || 0, c: p.c || 0 },
          name: p.name,
          goldCount: p.goldCount || 0,
          finishTime: p.finishTime,
          reachedGoal: Boolean(p.reachedGoal),
          joinedAt: p.joinedAt,
          startTime: p.startTime
        };

        this.players.set(id, player);
        if (id !== this.myUID) {
          this.opPositions.set(id, player.location);
        }
      });

      if (this.onPlayersUpdate) {
        this.onPlayersUpdate(this.getPlayers());
      }

      if (this.canvas) {
        this.game?.setOpponentsPos(this.opPositions);
        this.game?.setPlayersMap(this.players);
      }
    });
  };

  public removePlayerExplicitly = async (): Promise<void> => {
    if (this.isFirebaseReady && this.myUID) {
      await this.getPlayersRef().doc(this.myUID).delete();
    }
  };

  private removePlayer = async (player: Player): Promise<void> => {
    if (!this.isFirebaseReady) return;
    await this.getPlayersRef().doc(player.id).delete();
  };

  private updateMyLocation = (): void => {
    if (!this.isFirebaseReady) return;
    const myPlayer = this.game?.getMyPlayer();
    if (!myPlayer || !this.myUID) return;
    const newPos = myPlayer.location;
    const oldPos = this.lastUpdatedPosition;
    if (!oldPos || newPos.c !== oldPos.c || newPos.r !== oldPos.r) {
      this.getPlayersRef().doc(this.myUID).update(newPos);
      this.lastUpdatedPosition = newPos;
    }
  };

  private initNewGame = (seed: number) => {
    const size = MAZE_SIZE;
    this.golds = generateGold(size, seed);

    this.game = new Game(this.canvas, size, seed, this.myUID, (gold) => {
      if (this.onGoldHit && !gold.collectedBy) {
        this.onGoldHit(gold);
      }
    });

    if (this.canvas) {
      this.game.setOpponentsPos(this.opPositions);
      this.game.setGoldItems(this.golds);
      this.game.setPlayersMap(this.players);
    }
    this.isWinner = false;
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
    this.timerInterval = setInterval(update, 1000);
  };
}
