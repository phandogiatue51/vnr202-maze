import { ToastPosition } from 'react-toastify';
import { Control, Cord, Direction, Link, StringMap } from './type';

const LINKS: Array<Link> = [
  // { name: 'Home', url: 'https://shuby-mao.web.app/' },
  // { name: 'Project Page', url: 'https://shuby-mao.web.app/projects/web-multiplayer-maze' },
  { name: 'Multiplayer Maze', url: '/' },
  { name: 'Offline Maze', url: '/offline' },
  { name: 'Generation Demo', url: '/generation-demo' }
];

export const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_firebase_apiKey || process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:
    process.env.REACT_APP_firebase_authDomain || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL:
    process.env.REACT_APP_firebase_databaseURL || process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_firebase_projectId || process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:
    process.env.REACT_APP_firebase_storageBucket || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.REACT_APP_firebase_messagingSenderId ||
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_firebase_appId || process.env.REACT_APP_FIREBASE_APP_ID
};

const position: ToastPosition = 'top-right';

export const TOAST_CONFIG = {
  position,
  autoClose: 5000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined
};

export const KEY_MAP: StringMap = {
  ArrowLeft: Direction.LEFT,
  a: Direction.LEFT,
  A: Direction.LEFT,
  ArrowUp: Direction.TOP,
  w: Direction.TOP,
  W: Direction.TOP,
  ArrowRight: Direction.RIGHT,
  d: Direction.RIGHT,
  D: Direction.RIGHT,
  ArrowDown: Direction.DOWN,
  s: Direction.DOWN,
  S: Direction.DOWN
};
export const INSTRUCTION =
  'Control: w,a,s,d or ↑,←,↓,→. Use on-screen joystick on a touch screen device.';
export const IDLE_CONTROL: Control = { magnitude: 0, angle: 0 };
export const ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const ID_LEN = 10;
export const PLAYER_RADIUS_TO_CELL_RATIO = 0.15;
export const MAX_SPEED = 0.05;
export const START_POS: Cord = { r: 0.5, c: 0.5 };
export const GRID_PADDING = 5;
export const START_COLOR = '#DC2626';
export const END_COLOR = '#10B981';
export const BORDER_COLOR = '#64748b';
export const INDICATOR_COLOR = '#FF0000';
export const DEFAULT_PLAYER_COLOR = '#FBBF24';
export const MAZE_SIZE = 31;
export const MAZE_SEED = 12345;
export const VIEWPORT_SIZE = 3;

export default LINKS;
