import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';
import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';
import Canvas from '../components/canvas';
import QuestionModal from '../components/question-modal';
import Leaderboard from '../components/leaderboard';
import { FIREBASE_CONFIG, IDLE_CONTROL, TOAST_CONFIG } from '../constants';
import { getOnKey, getOffKey } from '../lib/misc-util';
import MultiplayerGame from '../lib/multiplayer-game';
import { CallBack, Gold, ItemType, Player } from '../type';
import { isEffectActive } from '../lib/item-logic';
import explosionImageUrl from '../assets/vu-no.png';

const callBack: CallBack = (success, msg) => {
  if (success) toast.success(msg, TOAST_CONFIG);
  else toast.error(msg, TOAST_CONFIG);
};

const TARGET_ITEM_LABELS: Record<'boom' | 'flash' | 'net' | 'smoke', string> = {
  boom: 'Boom',
  flash: 'Flash',
  net: 'Luoi',
  smoke: 'Smoke'
};

const INVENTORY_LABELS: Record<Exclude<ItemType, 'banana'>, string> = {
  torch: 'Duoc',
  boom: 'Boom',
  flash: 'Flash',
  net: 'Luoi',
  shield: 'Khien',
  smoke: 'Smoke'
};

const createOnLeave = (cleanUp: () => void) => {
  const onLeave = () => {
    cleanUp();
  };

  window.addEventListener('beforeunload', onLeave);
  window.addEventListener('pagehide', onLeave);
};

const getResponsiveCanvasSize = (): number => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (viewportWidth < 1100) {
    return Math.max(280, Math.min(viewportWidth - 48, viewportHeight - 260, 640));
  }

  const columnWidth = (viewportWidth - 112) / 2;
  return Math.max(360, Math.min(columnWidth, viewportHeight - 120, 820));
};

function MultiplayerMaze(): JSX.Element {
  const history = useHistory();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MultiplayerGame>();
  const animationRef = useRef(0);
  const control = useRef(IDLE_CONTROL);
  const keyDirs = useRef(0);
  const hitGoldRef = useRef<Gold | null>(null);
  const previousEffectsRef = useRef<Record<string, number | null | undefined>>({});
  const previousShieldRef = useRef<number>(0);

  const [canvasSize, setCanvasSize] = useState(getResponsiveCanvasSize);
  const [hitGold, setHitGold] = useState<Gold | null>(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [effectNow, setEffectNow] = useState(Date.now());
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'boom' | 'flash' | 'net' | 'smoke' | null>(
    null
  );

  const onKey = getOnKey(keyDirs, control);
  const offKey = getOffKey(keyDirs, control);
  const myPlayerId = gameRef.current?.getMyPlayerId();

  const myPlayer = useMemo(
    () => allPlayers.find((player) => player.id === myPlayerId),
    [allPlayers, myPlayerId]
  );
  const targetPlayers = useMemo(
    () => allPlayers.filter((player) => player.id !== myPlayerId),
    [allPlayers, myPlayerId]
  );

  const myInventory = myPlayer?.inventory || {};
  const myEffects = myPlayer?.effects || {};
  const collectedCount = myPlayer?.goldCount || 0;
  const shieldCount = myPlayer?.shieldCount || 0;
  const activeEffects = [
    isEffectActive(myEffects.torchUntil, effectNow) ? 'Duoc chi duong' : null,
    isEffectActive(myEffects.reversedUntil, effectNow) ? 'Dao phim' : null,
    isEffectActive(myEffects.rootedUntil, effectNow) ? 'Bi troi' : null,
    isEffectActive(myEffects.smokedUntil, effectNow) ? 'Khoi mu' : null,
    isEffectActive(myEffects.flashedUntil, effectNow) ? 'Flash trang man' : null
  ].filter(Boolean) as string[];

  useEffect(() => {
    const playerName = localStorage.getItem('playerName');
    const roomCode = localStorage.getItem('roomCode');
    if (!playerName || !roomCode) {
      history.push('/start');
      return undefined;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    const db = firebase.database();
    const statusRef = db.ref(`rooms/${roomCode}/status`);

    const listener = statusRef.on('value', (snapshot: firebase.database.DataSnapshot) => {
      const status = snapshot.val() || 'waiting';
      if (status !== 'started') {
        history.push('/lobby');
      }
    });

    return () => statusRef.off('value', listener);
  }, [history]);

  const animate: FrameRequestCallback = useCallback(() => {
    if (!hitGoldRef.current) {
      gameRef.current?.performMove(control.current);
    }
    gameRef.current?.render();
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const game = new MultiplayerGame(
      canvasRef.current,
      (win?: boolean) => {
        if (win) {
          setIsFinished(true);
        } else {
          if (localStorage.getItem('playerName')) {
            toast.error('Tran dau da ket thuc. Hay xem bang xep hang.', TOAST_CONFIG);
          }
          setIsGameOver(true);
        }
      },
      callBack,
      (gold: Gold) => {
        hitGoldRef.current = gold;
        setHitGold(gold);
      },
      (goldId: string, collectedBy: string) => {
        const activeGold = hitGoldRef.current;
        const currentPlayerId = gameRef.current?.getMyPlayerId();

        if (activeGold?.id === goldId) {
          hitGoldRef.current = null;
          setHitGold(null);

          if (collectedBy !== currentPlayerId) {
            toast.info('Tai lieu nay da duoc nguoi choi khac lay truoc do.', TOAST_CONFIG);
          }
        }
      },
      (seconds: number) => {
        setTimeLeft(seconds);
        if (seconds <= 0) setIsGameOver(true);
      },
      undefined,
      (players: Player[]) => {
        setAllPlayers(players);
      }
    );

    gameRef.current = game;
    const playerName = localStorage.getItem('playerName');
    if (playerName) {
      game.enterGame(playerName);
    }

    createOnLeave(() => {
      game.cleanUp();
    });

    return () => {
      game.cleanUp();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setCanvasSize(getResponsiveCanvasSize());
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [animate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setEffectNow(Date.now());
    }, 120);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const previousEffects = previousEffectsRef.current;
    const nextEffects = myEffects;

    const effectEntries: Array<{ key: keyof typeof nextEffects; message: string }> = [
      { key: 'reversedUntil', message: 'Ban dam phai vo chuoi, phim di chuyen bi dao trong 10 giay.' },
      { key: 'rootedUntil', message: 'Ban bi luoi chup, khong the di chuyen trong 5 giay.' },
      { key: 'smokedUntil', message: 'Ban bi smoke, man hinh bi lam mo trong 5 giay.' },
      { key: 'flashedUntil', message: 'Ban bi flash, man hinh bi choi trang trong 2 giay.' },
      { key: 'explosionUntil', message: 'Ban bi boom danh trung.' },
      { key: 'torchUntil', message: 'Duoc dang chi duong toi dich trong 10 giay.' }
    ];

    effectEntries.forEach(({ key, message }) => {
      const prev = previousEffects[key];
      const next = nextEffects[key];
      if ((!prev || prev <= effectNow) && typeof next === 'number' && next > effectNow) {
        toast.info(message, TOAST_CONFIG);
      }
    });

    if (previousShieldRef.current > 0 && shieldCount < previousShieldRef.current) {
      toast.info('Khien cua ban da chan mot hieu ung.', TOAST_CONFIG);
    }

    previousEffectsRef.current = { ...nextEffects };
    previousShieldRef.current = shieldCount;
  }, [effectNow, myEffects, shieldCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const useInstantItem = async (type: 'torch' | 'shield') => {
    const result = await gameRef.current?.useInventoryItem(type);
    if (!result) return;
    if (result.ok) toast.success(result.message, TOAST_CONFIG);
    else toast.error(result.message, TOAST_CONFIG);
  };

  const openTargetModal = (type: 'boom' | 'flash' | 'net' | 'smoke') => {
    if ((myInventory[type] || 0) <= 0) {
      toast.error(`Ban khong con ${INVENTORY_LABELS[type]}.`, TOAST_CONFIG);
      return;
    }

    if (targetPlayers.length === 0) {
      toast.info('Hien khong co nguoi choi khac de chon.', TOAST_CONFIG);
      return;
    }

    setSelectedAction(type);
    setShowTargetModal(true);
  };

  const handleUseOnTarget = async (targetId: string) => {
    if (!selectedAction) return;
    const result = await gameRef.current?.useInventoryItem(selectedAction, targetId);
    if (!result) return;

    if (result.ok) {
      toast.success(result.message, TOAST_CONFIG);
      setShowTargetModal(false);
      setSelectedAction(null);
      return;
    }

    toast.error(result.message, TOAST_CONFIG);
  };

  return (
    <>
      <div className="game-layout">
        <div className="maze-container-wrapper">
          <div
            tabIndex={0}
            role="button"
            onKeyDown={onKey}
            onKeyUp={offKey}
            className="maze-stage"
            aria-label="Maze game area"
          >
            <div className="maze-stage-inner">
              <Canvas ref={canvasRef} size={canvasSize} className="maze-canvas" />
              {isEffectActive(myEffects.smokedUntil, effectNow) && <div className="maze-overlay smoke" />}
              {isEffectActive(myEffects.flashedUntil, effectNow) && <div className="maze-overlay flash" />}
              {isEffectActive(myEffects.explosionUntil, effectNow) && (
                <div className="maze-explosion">
                  <img src={explosionImageUrl} alt="Explosion effect" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="live-leaderboard-wrapper">
          <div className="leaderboard-stats">
            <div className="leaderboard-stat-pill">
              <span className="leaderboard-stat-label">Thoi gian con lai</span>
              <span className="leaderboard-stat-value">{formatTime(timeLeft)}</span>
            </div>
            <div className="leaderboard-stat-pill">
              <span className="leaderboard-stat-label">Tai lieu</span>
              <span className="leaderboard-stat-value">{collectedCount}</span>
            </div>
          </div>

          <div className="combat-panel">
            <div className="combat-panel-header">
              <h3>Vat pham va trang thai</h3>
              <span>Khien: {shieldCount}</span>
            </div>

            <div className="inventory-grid">
              {(
                ['torch', 'shield', 'boom', 'flash', 'net', 'smoke'] as Array<
                  Exclude<ItemType, 'banana'>
                >
              ).map((itemType) => {
                const count = myInventory[itemType] || 0;
                const isInstant = itemType === 'torch' || itemType === 'shield';
                return (
                  <button
                    key={itemType}
                    type="button"
                    className="inventory-card"
                    disabled={count <= 0}
                    onClick={() =>
                      isInstant
                        ? useInstantItem(itemType as 'torch' | 'shield')
                        : openTargetModal(itemType as 'boom' | 'flash' | 'net' | 'smoke')
                    }
                  >
                    <span className="inventory-card-title">{INVENTORY_LABELS[itemType]}</span>
                    <span className="inventory-card-count">x{count}</span>
                    <span className="inventory-card-hint">
                      {isInstant ? 'Dung ngay' : 'Chon muc tieu'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="effect-chip-row">
              {activeEffects.length > 0 ? (
                activeEffects.map((effect) => (
                  <span key={effect} className="effect-chip">
                    {effect}
                  </span>
                ))
              ) : (
                <span className="effect-chip muted">Khong co hieu ung dang chay</span>
              )}
            </div>
          </div>

          <Leaderboard
            players={allPlayers}
            title="Bang xep hang truc tiep"
            myUID={myPlayerId}
            variant="live"
          />
        </div>
      </div>

      {hitGold && (
        <QuestionModal
          gold={hitGold}
          onClose={() => {
            hitGoldRef.current = null;
            setHitGold(null);
          }}
          onAnswer={async (correct: boolean) => {
            if (correct) {
              const collected = await gameRef.current?.collectGold(hitGold);
              if (collected) {
                toast.success('Chinh xac! Ban da thu thap duoc tai lieu.', TOAST_CONFIG);
              } else {
                toast.info('Tai lieu nay da duoc nguoi choi khac lay truoc do.', TOAST_CONFIG);
              }
            } else {
              toast.error('Sai cau tra loi. Hay thu lai sau.', TOAST_CONFIG);
            }

            hitGoldRef.current = null;
            setHitGold(null);
          }}
        />
      )}

      {showTargetModal && selectedAction && (
        <div className="player-target-modal-backdrop">
          <div className="player-target-modal">
            <div className="player-target-modal-header">
              <div>
                <h3>Chon nguoi choi</h3>
                <p>Dung {TARGET_ITEM_LABELS[selectedAction]} len nguoi choi khac.</p>
              </div>
              <button
                type="button"
                className="player-target-close"
                onClick={() => {
                  setShowTargetModal(false);
                  setSelectedAction(null);
                }}
              >
                Dong
              </button>
            </div>

            <div className="player-target-list">
              {targetPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="player-target-row"
                  onClick={() => handleUseOnTarget(player.id)}
                >
                  <span>{player.name || `Nguoi choi ${player.id.substring(0, 4)}`}</span>
                  <span>Tai lieu: {player.goldCount || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(isGameOver || isFinished) && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <Leaderboard
              players={allPlayers}
              title="Ket qua tran dau"
              myUID={myPlayerId}
              variant="result"
            />
            <div className="game-over-actions">
              <button
                type="button"
                className="menu-btn btn-rule"
                onClick={() => {
                  localStorage.removeItem('playerName');
                  localStorage.removeItem('roomCode');
                  localStorage.removeItem('isHost');
                  window.location.href = '#/';
                }}
              >
                Thoat ra menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MultiplayerMaze;
