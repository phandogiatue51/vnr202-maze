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
import boomImageUrl from '../assets/boom.png';
import flashImageUrl from '../assets/flash.jpg';
import torchImageUrl from '../assets/duoc.jpg';
import shieldImageUrl from '../assets/khien.jpg';
import netImageUrl from '../assets/luoi.png';
import smokeImageUrl from '../assets/smoke.png';
import bananaUrl from '../assets/banana-01.png';

type EffectPopup = {
  id: string;
  title: string;
  message: string;
  image: string;
};

const callBack: CallBack = (success, msg) => {
  if (success) toast.success(msg, TOAST_CONFIG);
  else toast.error(msg, TOAST_CONFIG);
};

const TARGET_ITEM_LABELS: Record<'boom' | 'flash' | 'net' | 'smoke', string> = {
  boom: 'Boom',
  flash: 'Flash',
  net: 'Lưới',
  smoke: 'Smoke'
};

const INVENTORY_LABELS: Record<Exclude<ItemType, 'banana'>, string> = {
  torch: 'Đuốc',
  boom: 'Boom',
  flash: 'Flash',
  net: 'Lưới',
  shield: 'Khiên',
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
  const shownEffectPopupRef = useRef<Record<string, number | string | null | undefined>>({});

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
  const [effectPopupQueue, setEffectPopupQueue] = useState<EffectPopup[]>([]);
  const [activeEffectPopup, setActiveEffectPopup] = useState<EffectPopup | null>(null);

  const onKey = getOnKey(keyDirs, control);
  const offKey = getOffKey(keyDirs, control);
  const myPlayerId = gameRef.current?.getMyPlayerId();

  const myPlayer = useMemo(
    () => allPlayers.find((player) => player.id === myPlayerId),
    [allPlayers, myPlayerId]
  );
  const targetPlayers = useMemo(
    () => allPlayers.filter((player) => player.id !== myPlayerId && !player.reachedGoal),
    [allPlayers, myPlayerId]
  );

  const myInventory = myPlayer?.inventory || {};
  const myEffects = myPlayer?.effects || {};
  const collectedCount = myPlayer?.goldCount || 0;
  const shieldCount = myPlayer?.shieldCount || 0;
  const activeEffects = [
    isEffectActive(myEffects.torchUntil, effectNow) ? 'Đuốc chỉ đường' : null,
    isEffectActive(myEffects.reversedUntil, effectNow) ? 'Đảo phím' : null,
    isEffectActive(myEffects.rootedUntil, effectNow) ? 'Bị trói' : null,
    isEffectActive(myEffects.smokedUntil, effectNow) ? 'Khói mù' : null,
    isEffectActive(myEffects.flashedUntil, effectNow) ? 'Flash trắng màn' : null
  ].filter(Boolean) as string[];

  const queueEffectPopup = useCallback((popup: Omit<EffectPopup, 'id'>) => {
    setEffectPopupQueue((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...popup
      }
    ]);
  }, []);

  useEffect(() => {
    if (activeEffectPopup || effectPopupQueue.length === 0) return undefined;

    // Delay 150ms trước khi show popup tiếp theo
    // → mắt kịp nhận ra popup cũ đã mất trước khi popup mới xuất hiện
    const showDelay = window.setTimeout(() => {
      const [nextPopup, ...rest] = effectPopupQueue;
      setActiveEffectPopup(nextPopup);
      setEffectPopupQueue(rest);

      const hideTimeout = window.setTimeout(() => {
        setActiveEffectPopup((current) => (current?.id === nextPopup.id ? null : current));
      }, 1000);

      return () => window.clearTimeout(hideTimeout);
    }, 150);

    return () => window.clearTimeout(showDelay);
  }, [activeEffectPopup, effectPopupQueue]);

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
            toast.error('Trận đấu đã kết thúc. Hãy xem bảng xếp hạng.', TOAST_CONFIG);
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
            toast.info('Tài liệu này đã được người chơi khác lấy trước đó.', TOAST_CONFIG);
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
    if (!myPlayerId || !myPlayer) {
      return;
    }

    const nextEffects = myEffects;

    const effectEntries: Array<{
      key: keyof typeof nextEffects;
      title: string;
      message: string;
      image: string;
    }> = [
        {
          key: 'reversedUntil',
          title: 'Dẫm Phải Vỏ Chuối',
          message: 'Phím di chuyển của bạn bị đảo trong 10 giây.',
          image: bananaUrl
        },
        {
          key: 'rootedUntil',
          title: 'Bị Lưới Chụp',
          message: 'Bạn không thể di chuyển trong 5 giây.',
          image: netImageUrl
        },
        {
          key: 'smokedUntil',
          title: 'Bị Smoke',
          message: 'Tầm nhìn của bạn bị làm mờ trong 5 giây.',
          image: smokeImageUrl
        },
        {
          key: 'flashedUntil',
          title: 'Bị Flash',
          message: 'Màn hình của bạn bị chói trắng trong 2 giây.',
          image: flashImageUrl
        },
        {
          key: 'explosionUntil',
          title: 'Bị Ném Boom',
          message: 'Bạn vừa bị đối thủ ném boom trúng.',
          image: boomImageUrl
        },
        {
          key: 'torchUntil',
          title: 'Đuốc Đang Chỉ Đường',
          message: 'Hãy đi theo đường line vàng trong 10 giây để tới đích.',
          image: torchImageUrl
        }
      ];

    effectEntries.forEach(({ key, title, message, image }) => {
      const next = nextEffects[key];
      const shownValue = shownEffectPopupRef.current[key];

      if (typeof next === 'number' && next > effectNow && shownValue !== next) {
        queueEffectPopup({ title, message, image });
        shownEffectPopupRef.current[key] = next;
        return;
      }

      if (!next || next <= effectNow) {
        shownEffectPopupRef.current[key] = null;
      }
    });

    const shieldPopupKey = `shield-block-${previousShieldRef.current}->${shieldCount}`;
    if (
      previousShieldRef.current > 0 &&
      shieldCount < previousShieldRef.current &&
      shownEffectPopupRef.current.shieldBlocked !== shieldPopupKey
    ) {
      queueEffectPopup({
        title: 'Khiên Đã Chặn Đòn',
        message: 'Khiên của bạn đã chặn một hiệu ứng từ đối thủ.',
        image: shieldImageUrl
      });
      shownEffectPopupRef.current.shieldBlocked = shieldPopupKey;
    }

    previousEffectsRef.current = { ...nextEffects };
    previousShieldRef.current = shieldCount;
  }, [effectNow, myEffects, myPlayer, myPlayerId, queueEffectPopup, shieldCount]);

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
      toast.error(`Bạn không còn ${INVENTORY_LABELS[type]}.`, TOAST_CONFIG);
      return;
    }

    if (targetPlayers.length === 0) {
      toast.info('Hiện không có người chơi nào chưa về đích để chọn.', TOAST_CONFIG);
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
              <span className="leaderboard-stat-label">Thời gian còn lại</span>
              <span className="leaderboard-stat-value">{formatTime(timeLeft)}</span>
            </div>
            <div className="leaderboard-stat-pill">
              <span className="leaderboard-stat-label">Tài liệu</span>
              <span className="leaderboard-stat-value">{collectedCount}</span>
            </div>
          </div>

          <div className="combat-panel">
            <div className="combat-panel-header">
              <h3>Vật phẩm và trạng thái</h3>
              <span>Khiên: {shieldCount}</span>
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
                      {isInstant ? 'Tự kích hoạt khi nhặt' : 'Chọn mục tiêu'}
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
                <span className="effect-chip muted">Không có hiệu ứng đang chạy</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeEffectPopup && (
        <div className="effect-notice-layer" aria-live="polite">
          <div className="effect-notice-card">
            <img src={activeEffectPopup.image} alt={activeEffectPopup.title} className="effect-notice-image" />
            <h3>{activeEffectPopup.title}</h3>
            <p>{activeEffectPopup.message}</p>
          </div>
        </div>
      )}

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
                toast.success('Chính xác! Bạn đã thu thập được tài liệu.', TOAST_CONFIG);
              } else {
                toast.info('Tài liệu này đã được người chơi khác lấy trước đó.', TOAST_CONFIG);
              }
            } else {
              toast.error('Sai câu trả lời. Hãy thử lại sau.', TOAST_CONFIG);
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
                <h3>Chọn người chơi</h3>
                <p>Dùng {TARGET_ITEM_LABELS[selectedAction]} lên người chơi chưa về đích.</p>
              </div>
              <button
                type="button"
                className="player-target-close"
                onClick={() => {
                  setShowTargetModal(false);
                  setSelectedAction(null);
                }}
              >
                Đóng
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
                  <span>{player.name || `Người chơi ${player.id.substring(0, 4)}`}</span>
                  <span>Tài liệu: {player.goldCount || 0}</span>
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
              title="Kết quả trận đấu"
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
                Thoát ra menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MultiplayerMaze;
