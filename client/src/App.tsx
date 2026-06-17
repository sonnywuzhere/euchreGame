import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import Game from './pages/Game';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="/game/:code" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}
