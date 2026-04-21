import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import { FIREBASE_CONFIG, MAZE_SIZE } from '../constants';
import { CallBack, CanvasOrNull, Control, Cord, Player, Gold } from '../type';
import Game from './game';
import { generateGold } from './gold-logic';

const REFRESH_THRESHOLD = 3;

type Auth = firebase.auth.Auth;
type Firestore = firebase.firestore.Firestore;
type DocumentReference = firebase.firestore.DocumentReference;
type DocumentSnapshot = firebase.firestore.DocumentSnapshot;
type QuerySnapshot = firebase.firestore.QuerySnapshot;

export default class MultiplayerGame {
  private isWinner: boolean;

  private myUID?: string;

  private lastUpdatedPosition?: Cord;

  private opPositions: Map<string, Cord>;

  private unsubscribePlayers?: () => void;

  private counter = 0;

  private golds: Gold[] = [];

  private players: Map<string, Player> = new Map();
  private isEntered = false;
  private playerName?: string;
  private game!: Game;

  private canvas: CanvasOrNull;

  private firestore!: Firestore;

  private onGameOver?: CallBack;

  private callBack?: CallBack;

  private onGoldHit?: (gold: Gold) => void;

  private onTimerUpdate?: (secondsLeft: number) => void;

  private onStatusUpdate?: (status: 'waiting' | 'started') => void;

  private onPlayersUpdate?: (players: Player[]) => void;

  private timerInterval?: NodeJS.Timeout;
  private secondsLeft = 300; // 5 minutes default
  private startTime?: number;

  constructor(
    canvas: CanvasOrNull,
    onGameOver?: CallBack,
    callBack?: CallBack,
    onGoldHit?: (gold: Gold) => void,
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
    this.onTimerUpdate = onTimerUpdate;
    this.onStatusUpdate = onStatusUpdate;
    this.onPlayersUpdate = onPlayersUpdate;
    this.initFirebaseService();
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
        this.firestore.collection('players').doc(this.myUID).update({
          finishTime: Date.now()
        });
      }
      if (this.onGameOver) this.onGameOver(true);
    }
  };

  public render = (): void => {
    if (this.canvas) this.game?.renderGame();
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
    if (!this.myUID) return;
    const now = Date.now();
    this.startTime = now;
    this.secondsLeft = 300; // 5 minutes
    
    await this.firestore.collection('players').doc(this.myUID).update({
      startTime: now,
      finishTime: null,
      goldCount: 0,
      r: 0.5,
      c: 0.5
    });

    this.startLocalTimer(now + 300 * 1000);
    this.initNewGame(12345); // Or a random seed
  };

  public purgePlayers = async (): Promise<void> => {
    const snapshot = await this.firestore.collection('players').get();
    const batch = this.firestore.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  };

  public collectGold = async (gold: Gold): Promise<void> => {
    if (!this.myUID) return;
    const playerRef = this.firestore.collection('players').doc(this.myUID);

    // Mark locally as collected
    const goldItem = this.golds.find((g) => g.id === gold.id);
    if (goldItem) {
      goldItem.collectedBy = this.myUID;
      if (this.game) this.game.setGoldItems(this.golds);
    }

    await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(playerRef);
      if (doc.exists) {
        const data = doc.data();
        const currentGold = data?.goldCount || 0;
        transaction.update(playerRef, { goldCount: currentGold + 1 });
      }
    });
  };

  public enterGame = (name: string): void => {
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
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  };

  private initFirebaseService = () => {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    const app = firebase.app();
    this.firestore = app.firestore();
    const auth = app.auth();
    this.signInAndInitListener(auth);
  };

  private signInAndInitListener = (auth: Auth) => {
    auth.signInAnonymously().catch((error) => {
      console.error('Firebase Auth Error:', error);
      if (this.callBack) {
        this.callBack(false, `Login failed: ${error.message || 'Unknown error'}`);
      }
    });
    auth.onAuthStateChanged((user) => {
      if (user) {
        if (this.callBack) this.callBack(true, `Login Success.`);
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
    const name = this.playerName || localStorage.getItem('playerName') || 'Anonymous';
    if (!this.myUID) return;

    const playerRef = this.firestore.collection('players').doc(this.myUID);
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
          joinedAt: now,
          startTime: now,
          finishTime: null
        });
        this.startLocalTimer(now + 300 * 1000);
      } else {
        const data = doc.data();
        this.startTime = data?.startTime || now;
        await playerRef.update({
          name,
          ...location
        });
        this.startLocalTimer((this.startTime || now) + 300 * 1000);
      }
      this.initNewGame(12345);
    } catch (e) {
      console.error('Sync player failed:', e);
    }
  };

  private addPlayersListener = (): void => {
    this.unsubscribePlayers = this.firestore.collection('players').onSnapshot((snapshot) => {
      this.players.clear();
      this.opPositions.clear();
      
      snapshot.forEach((doc) => {
        const id = doc.id;
        const p = doc.data();
        
        const player: Player = {
          id,
          location: { r: p.r || 0, c: p.c || 0 },
          name: p.name,
          goldCount: p.goldCount || 0,
          finishTime: p.finishTime,
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

  // registerPlayer is now merged into syncPlayer

  public removePlayerExplicitly = async (): Promise<void> => {
    if (this.myUID) {
      await this.firestore.collection('players').doc(this.myUID).delete();
    }
  };

  private removePlayer = async (player: Player): Promise<void> => {
    await this.firestore.collection('players').doc(player.id).delete();
  };

  private updateMyLocation = (): void => {
    const myPlayer = this.game?.getMyPlayer();
    if (!myPlayer || !this.myUID) return;
    const newPos = myPlayer.location;
    const oldPos = this.lastUpdatedPosition;
    if (!oldPos || newPos.c !== oldPos.c || newPos.r !== oldPos.r) {
      this.firestore.collection('players').doc(this.myUID).update(newPos);
      this.lastUpdatedPosition = newPos;
    }
  };

  private initNewGame = (seed: number) => {
    const size = MAZE_SIZE;
    this.golds = generateGold(size, seed);

    this.game = new Game(this.canvas, 10, seed, this.myUID, (gold) => {
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
          // Set finishTime to now if they didn't win but time ran out
          if (this.myUID) {
            await this.firestore.collection('players').doc(this.myUID).update({
              finishTime: Date.now()
            });
          }
          if (this.onGameOver) this.onGameOver(false);
        }
      }
    };

    update();
    this.timerInterval = setInterval(update, 1000);
  };
}
