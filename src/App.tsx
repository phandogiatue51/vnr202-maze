import React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import GenerationDemo from './pages/generation-demo';
import OfflineMaze from './pages/offline-maze';
import MultiplayerMaze from './pages/multiplayer-maze';
import HomePage from './pages/home-page';
import LobbyPage from './pages/lobby-page';
import RulesPage from './pages/rules-page';
import NameEntryPage from './pages/name-entry-page';

function App(): JSX.Element {
  return (
    <>
      <ToastContainer />
      <Switch>
        <Route exact path="/offline">
          <OfflineMaze />
        </Route>
        <Route exact path="/generation-demo">
          <GenerationDemo />
        </Route>
        <Route path="/lobby" component={LobbyPage} />
        <Route path="/game" component={MultiplayerMaze} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/start" component={NameEntryPage} />
        <Route exact path="/">
          <HomePage />
        </Route>
        <Redirect to="/" />
      </Switch>
    </>
  );
}

export default App;
