import React, { useState, useEffect } from 'react';

interface EmoteProps {
    emoji: string;
    startRef: React.RefObject<HTMLDivElement>;
    onEnd: () => void;
}

const Emote: React.FC<EmoteProps> = ({ emoji, startRef, onEnd }) => {
    const [startPos, setStartPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (startRef.current) {
            const rect = startRef.current.getBoundingClientRect();
            setStartPos({
                top: rect.top + rect.height / 2,
                left: rect.left + rect.width / 2,
            });
        }
    }, [startRef]);

    if (startPos.top === 0) return null; // Don't render until position is calculated

    return (
        <div 
            className="fixed text-5xl z-30 pointer-events-none animate-emote-fall"
            style={{
                top: startPos.top,
                left: startPos.left,
            }}
            onAnimationEnd={onEnd}
        >
            {emoji}

            <style>{`
                @keyframes emote-fall-anim {
                    0% {
                        transform: translate(-50%, -50%) scale(0.5);
                        opacity: 0;
                    }
                    20% {
                        transform: translate(-50%, -50%) scale(1.2);
                        opacity: 1;
                    }
                    80% {
                        transform: translate(-50%, 200px) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, 300px) scale(0.8);
                        opacity: 0;
                    }
                }
                .animate-emote-fall {
                    animation: emote-fall-anim 3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default Emote;