import React from 'react';

const Header: React.FC = () => {
    return (
        <header className="text-center py-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                Caro AI Arena
            </h1>
            <p className="text-slate-400 mt-2">A modern Caro game with a challenging AI and online play.</p>
        </header>
    );
};

export default Header;
