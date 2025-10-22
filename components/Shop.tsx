import React, { useState } from 'react';
import type { Cosmetic, PieceStyle, Avatar, Emoji, GameTheme, PieceEffect, VictoryEffect, BoomEffect } from '../types';
import { ALL_COSMETICS } from '../constants';
import { useGameState } from '../context/GameStateContext';
import Modal from './Modal';
import { useSound } from '../hooks/useSound';

type ShopCategory = 'Skins' | 'Avatars' | 'Emojis' | 'Themes' | 'Effects' | 'Victory' | 'Booms';

const Shop: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { gameState, purchaseCosmetic } = useGameState();
  const { playSound } = useSound();
  const [activeTab, setActiveTab] = useState<ShopCategory>('Skins');
  const [confirmingPurchase, setConfirmingPurchase] = useState<Cosmetic | null>(null);

  const cosmeticTypeMap: Record<ShopCategory, 'piece' | 'avatar' | 'emoji' | 'theme' | 'effect' | 'victory' | 'boom'> = {
    Skins: 'piece',
    Avatars: 'avatar',
    Emojis: 'emoji',
    Themes: 'theme',
    Effects: 'effect',
    Victory: 'victory',
    Booms: 'boom',
  };
  
  const handlePurchase = (cosmetic: Cosmetic) => {
    playSound('confirm');
    if(purchaseCosmetic(cosmetic)) {
      // Potentially play a success sound
    }
    setConfirmingPurchase(null);
  };

  const handleConfirmClick = (cosmetic: Cosmetic) => {
    playSound('select');
    setConfirmingPurchase(cosmetic);
  }
  
  const filteredCosmetics = ALL_COSMETICS.filter(c => c.type === cosmeticTypeMap[activeTab as ShopCategory]);

  const renderItemPreview = (cosmetic: Cosmetic) => {
      switch(cosmetic.type) {
          case 'piece': {
              const PieceComp = (cosmetic.item as PieceStyle).component;
              return <PieceComp className="w-16 h-16 text-cyan-300" />;
          }
          case 'avatar': {
              return <img src={(cosmetic.item as Avatar).url} alt={cosmetic.name} className="w-16 h-16 rounded-full object-cover bg-slate-700" />;
          }
          case 'emoji':
              return <span className="text-4xl">{(cosmetic.item as Emoji).emoji}</span>
          case 'theme': {
              const theme = cosmetic.item as GameTheme;
              return (
                <div 
                    className={`w-16 h-16 rounded-md flex items-center justify-center p-2 bg-cover bg-center ${theme.boardBg}`}
                    style={theme.boardBgImage ? { 
                        backgroundImage: `url(${theme.boardBgImage})`,
                    } : {}}
                >
                    <div className={`w-10 h-10 rounded ${theme.cellBg} border-2 ${theme.gridColor}`} />
                </div>);
          }
          case 'effect': {
              const PreviewComp = (cosmetic.item as PieceEffect).previewComponent;
              return <div className="w-16 h-16 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
          case 'victory': {
              const PreviewComp = (cosmetic.item as VictoryEffect).previewComponent;
              return <div className="w-16 h-16 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
          case 'boom': {
              const PreviewComp = (cosmetic.item as BoomEffect).previewComponent;
              return <div className="w-16 h-16 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
          default:
              return null;
      }
  }
  
  const renderContent = () => {
    return (
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredCosmetics.map(cosmetic => {
            const isOwned = gameState.ownedCosmeticIds.includes(cosmetic.id);
            const canAfford = gameState.coins >= cosmetic.price;
            const isConsumableEmoji = cosmetic.type === 'emoji' && cosmetic.price > 0;
            const ownedEmojiCount = gameState.emojiInventory[cosmetic.id] || 0;

            return (
              <div key={cosmetic.id} className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 flex flex-col items-center text-center transition-all duration-300 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10">
                {isConsumableEmoji && ownedEmojiCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-slate-800">
                        {ownedEmojiCount}
                    </div>
                )}
                <div className="h-24 w-24 mb-3 flex items-center justify-center bg-slate-900/70 rounded-lg p-2">
                    {renderItemPreview(cosmetic)}
                </div>
                 <h3 className="text-md font-semibold text-white mb-2 h-10 flex items-center justify-center">{cosmetic.name}</h3>

                {isOwned && !isConsumableEmoji ? (
                    <button disabled className="w-full mt-auto py-2 px-3 rounded-lg text-sm font-semibold bg-green-600 text-white cursor-not-allowed">
                        Owned
                    </button>
                ) : (
                    <button
                        onClick={() => handleConfirmClick(cosmetic)}
                        disabled={!canAfford}
                        className={`w-full mt-auto py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm ${canAfford ? 'bg-cyan-500 hover:bg-cyan-400 text-black' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
                    >
                        <span>{cosmetic.price}</span>
                        <span className="text-yellow-800">💰</span>
                    </button>
                )}
              </div>
            );
          })}
        </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 h-screen bg-slate-900 text-white relative flex flex-col">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
      <div className="max-w-6xl mx-auto relative z-10 w-full flex flex-col flex-grow overflow-hidden">
        <header className="flex-shrink-0">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-bold text-cyan-400">Shop</h1>
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full">
                    <span className="text-yellow-400 font-bold text-lg">{gameState.coins}</span>
                    <span className="text-yellow-400 text-lg">💰</span>
                </div>
              </div>
              <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Back
              </button>
            </div>
        </header>

        <div className="flex-shrink-0 mb-8 border-b border-slate-700">
            <nav className="flex space-x-1 sm:space-x-2 md:space-x-4 overflow-x-auto pb-px scrollbar-hide">
                {(['Skins', 'Avatars', 'Emojis', 'Themes', 'Effects', 'Victory', 'Booms'] as ShopCategory[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2 px-3 text-base sm:text-lg font-semibold transition-colors whitespace-nowrap ${activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        {tab}
                    </button>
                ))}
            </nav>
        </div>
        
        <main className="flex-grow overflow-y-auto pr-2 -mr-2 scrollbar-hide">
            {renderContent()}
        </main>
      </div>

       <Modal isOpen={!!confirmingPurchase} onClose={() => setConfirmingPurchase(null)} title="Confirm Purchase">
         {confirmingPurchase && (
            <div className='text-center'>
                <p className="text-slate-300 mb-6">Are you sure you want to buy <strong className='text-white'>{confirmingPurchase.name}</strong> for <strong className='text-yellow-400'>{confirmingPurchase.price} 💰</strong>?</p>
                <div className='flex justify-center gap-4'>
                    <button
                        onClick={() => { playSound('select'); setConfirmingPurchase(null); }}
                        className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handlePurchase(confirmingPurchase)}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors animate-confirm-glow"
                    >
                        Confirm
                    </button>
                </div>
            </div>
         )}
        </Modal>
    </div>
  );
};

export default Shop;
