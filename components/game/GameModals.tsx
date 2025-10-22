import React, { useState } from 'react';
import Modal from '../Modal';
import { useGameState } from '../../context/GameStateContext';
import { MUSIC_TRACKS } from '../../constants';
import type { SoundEffect } from '../../hooks/useSound';
import { useSound } from '../../hooks/useSound';

interface UndoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  playSound: (sound: SoundEffect) => void;
}

export const UndoModal: React.FC<UndoModalProps> = ({ isOpen, onClose, onConfirm, playSound }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Confirm Undo">
    <div className='text-center'>
      <p className="text-slate-300 mb-6">Undoing your last move will cost <strong className='text-yellow-400'>20 💰</strong>. Are you sure?</p>
      <div className='flex justify-center gap-4'>
        <button onClick={() => { playSound('select'); onClose(); }} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
        <button onClick={onConfirm} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors animate-confirm-glow">Confirm</button>
      </div>
    </div>
  </Modal>
);

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShop?: () => void;
  onOpenInventory?: () => void;
  onResign?: () => void;
  onLogOut?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenShop, onOpenInventory, onResign, onLogOut }) => {
  const { gameState, toggleSound, toggleMusic, setSoundVolume, setMusicVolume, equipMusic } = useGameState();
  const { playSound } = useSound();
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);

  const handleMusicSelect = (musicUrl: string) => {
    playSound('select');
    equipMusic(musicUrl);
  };
  
  const handleLogoutClick = () => {
    playSound('select');
    setIsConfirmingLogout(true);
  }

  const confirmLogout = () => {
    if (onLogOut) {
        onLogOut();
    }
    setIsConfirmingLogout(false);
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings">
        <div className="space-y-4 text-white">
          <div className="rounded-lg overflow-hidden border border-slate-700 divide-y divide-slate-700">
            <div className="flex justify-between items-center px-4 py-3 hover:bg-slate-700/50 transition-colors">
              <span className="font-semibold">Sound</span>
              <div className="flex-grow flex items-center gap-4 mx-4">
                <input type="range" min="0" max="1" step="0.01" value={gameState.soundVolume} onChange={(e) => setSoundVolume(Number(e.target.value))} disabled={!gameState.isSoundOn} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
              </div>
              <button onClick={() => { playSound('select'); toggleSound(); }} className={`font-bold w-12 text-center ${gameState.isSoundOn ? 'text-cyan-400' : 'text-slate-500'}`}>{gameState.isSoundOn ? 'ON' : 'OFF'}</button>
            </div>
            <div className="flex justify-between items-center px-4 py-3 hover:bg-slate-700/50 transition-colors">
              <span className="font-semibold">Music</span>
              <div className="flex-grow flex items-center gap-4 mx-4">
                <input type="range" min="0" max="1" step="0.01" value={gameState.musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} disabled={!gameState.isMusicOn} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer" />
              </div>
              <button onClick={() => { playSound('select'); toggleMusic(); }} className={`font-bold w-12 text-center ${gameState.isMusicOn ? 'text-cyan-400' : 'text-slate-500'}`}>{gameState.isMusicOn ? 'ON' : 'OFF'}</button>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-300 mb-2 px-1">Select Music</h3>
            <div>
              <select value={gameState.activeMusicUrl} onChange={(e) => handleMusicSelect(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500">
                {MUSIC_TRACKS.map(track => (<option key={track.id} value={track.url}>{track.name}</option>))}
              </select>
            </div>
          </div>
          {onOpenShop && onOpenInventory && (
              <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { onOpenShop(); onClose(); }} className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-lg transition-colors">Shop</button>
                  <button onClick={() => { onOpenInventory(); onClose(); }} className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-3 rounded-lg transition-colors">Inventory</button>
              </div>
          )}
          {onResign && <button onClick={() => { playSound('select'); onResign(); onClose(); }} className="w-full bg-orange-600 hover:bg-orange-500 font-bold py-3 rounded-lg transition-colors">Resign Game</button>}
          {onLogOut && <button onClick={handleLogoutClick} className="w-full bg-red-700 hover:bg-red-600 font-bold py-3 rounded-lg transition-colors">Log Out</button>}
          <button onClick={() => { playSound('select'); onClose(); }} className="w-full bg-slate-600 hover:bg-slate-500 font-bold py-3 rounded-lg transition-colors">Close</button>
        </div>
        <style>{`
          input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: #22d3ee; cursor: pointer; border-radius: 50%; } 
          input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; background: #22d3ee; cursor: pointer; border-radius: 50%; border: none; } 
          input[type="range"]:disabled::-webkit-slider-thumb { background: #64748b; } 
          input[type="range"]:disabled::-moz-range-thumb { background: #64748b; }
        `}</style>
      </Modal>

      <Modal isOpen={isConfirmingLogout} onClose={() => setIsConfirmingLogout(false)} title="Confirm Log Out">
         <div className='text-center'>
            <p className="text-slate-300 mb-6">Are you sure you want to log out?<br/>Any active game will be forfeit.</p>
            <div className='flex justify-center gap-4'>
                <button onClick={() => setIsConfirmingLogout(false)} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                <button onClick={confirmLogout} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">Log Out</button>
            </div>
        </div>
      </Modal>
    </>
  );
};