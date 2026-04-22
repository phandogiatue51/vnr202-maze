import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { toast } from 'react-toastify';
import firebase from 'firebase/app';
import 'firebase/firestore';
import Canvas from '../components/canvas';
import Container from '../components/container';
import QuestionModal from '../components/question-modal';
import Leaderboard from '../components/leaderboard';
import { FIREBASE_CONFIG, IDLE_CONTROL, TOAST_CONFIG } from '../constants';
import getCanvasSize, { getOnKey, getOffKey } from '../lib/misc-util';
import MultiplayerGame from '../lib/multiplayer-game';
import { CallBack, Control, Gold, Player } from '../type';

const callBack: CallBack = (success, msg) => {
  if (success) toast.success(msg, TOAST_CONFIG);
  else toast.error(msg, TOAST_CONFIG);
};

const createOnLeave = (cleanUp: () => void) => {
  const onLeave = () => {
    cleanUp();
  };
  window.addEventListener('beforeunload', onLeave);
  window.addEventListener('pagehide', onLeave);
};

function MultiplayerMaze(): JSX.Element {
  const history = useHistory();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bigScreen = useMediaQuery({ query: '(min-width: 600px)' });
  const midScreen = useMediaQuery({ query: '(min-width: 400px)' });
  const [canvasSize, setCanvasSize] = useState(getCanvasSize(bigScreen, midScreen));
  const gameRef = useRef<MultiplayerGame>();
  const animationRef = useRef(0);
  const control = useRef<Control>(IDLE_CONTROL);
  const keyDirs = useRef(0);
  const [hitGold, setHitGold] = useState<Gold | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  const onKey = getOnKey(keyDirs, control);
  const offKey = getOffKey(keyDirs, control);

  const hitGoldRef = useRef<Gold | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [collectedCount, setCollectedCount] = useState(0);

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

    const unsubscribe = firebase
      .app()
      .firestore()
      .collection('rooms')
      .doc(roomCode)
      .onSnapshot((snapshot) => {
        const status = snapshot.data()?.status || 'waiting';
        if (status !== 'started') {
          history.push('/lobby');
        }
      });

    return () => unsubscribe();
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
      (win) => {
        if (win) {
          setIsFinished(true);
        } else {
          const playerName = localStorage.getItem('playerName');
          if (playerName) {
            toast.error('Trận đấu đã kết thúc. Hãy xem bảng xếp hạng.', TOAST_CONFIG);
          }
          setIsGameOver(true);
        }
      },
      callBack,
      (gold) => {
        hitGoldRef.current = gold;
        setHitGold(gold);
      },
      (seconds) => {
        setTimeLeft(seconds);
        if (seconds <= 0) setIsGameOver(true);
      }
    );
    gameRef.current = game;
    const playerName = localStorage.getItem('playerName');
    if (playerName) {
      game.enterGame(playerName);
    }

    const interval = setInterval(() => {
      if (gameRef.current) {
        setAllPlayers(gameRef.current.getPlayers());
      }
    }, 1000);

    createOnLeave(() => {
      clearInterval(interval);
      game.cleanUp();
    });
    return () => {
      clearInterval(interval);
      game.cleanUp();
    };
  }, []);

  useEffect(() => {
    setCanvasSize(getCanvasSize(bigScreen, midScreen));
  }, [bigScreen, midScreen]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [animate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="timer-overlay">
        <span className="timer-label">Thời gian còn lại:</span>
        <span className="timer-value">{formatTime(timeLeft)}</span>
      </div>
      <div className="timer-overlay" style={{ right: '20px', left: 'auto' }}>
        <span className="timer-label">Tài liệu:</span>
        <span className="timer-value">{collectedCount}</span>
      </div>

      <div className="game-layout">
        <div className="maze-container-wrapper">
          <Container onKeyDown={onKey} onKeyUp={offKey}>
            <Canvas ref={canvasRef} size={canvasSize} />
          </Container>
        </div>

        <div className="live-leaderboard-wrapper">
          <Leaderboard
            players={allPlayers}
            title="Bảng xếp hạng trực tiếp"
            myUID={gameRef.current?.getMyPlayerId()}
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
          onAnswer={async (correct) => {
            if (correct) {
              const collected = await gameRef.current?.collectGold(hitGold);
              if (collected) {
                setCollectedCount((prev) => prev + 1);
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

      {(isGameOver || isFinished) && (
        <div className="game-over-overlay">
          <Leaderboard
            players={allPlayers.filter((p) => p.finishTime)}
            title="Kết quả trận đấu"
            myUID={gameRef.current?.getMyPlayerId()}
          />
          <div
            className="mt-4"
            style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              className="menu-btn btn-play"
              onClick={() => window.location.reload()}
            >
              Chơi lại
            </button>
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
      )}
    </>
  );
}

export default MultiplayerMaze;
