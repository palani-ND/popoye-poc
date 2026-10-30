import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PayNow from './pages/PayNow.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/p/:token" element={<PayNow />} />
        <Route path="*" element={<PayNow />} />
      </Routes>
    </BrowserRouter>
  );
}
