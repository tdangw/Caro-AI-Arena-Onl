import { useCallback, useRef, useEffect } from 'react';
import { useGameState } from '../context/GameStateContext';

export type SoundEffect = 'move' | 'win' | 'lose' | 'click' | 'announce_win' | 'announce_lose' | 'check' | 'first_move_player' | 'first_move_ai' | 'deciding' | 'boom' | 'select' | 'confirm' | 'summary';

const soundFiles: Record<SoundEffect, string> = {
    move: 'assets/sounds/move.mp3',
    win: 'assets/sounds/win.mp3',
    lose: 'assets/sounds/lose.mp3',
    click: 'assets/sounds/click.mp3',
    announce_win: 'assets/sounds/announce_win.mp3',
    announce_lose: 'assets/sounds/announce_lose.mp3',
    check: 'assets/sounds/check.mp3',
    first_move_player: 'assets/sounds/first_move_player.mp3',
    first_move_ai: 'assets/sounds/first_move_ai.mp3',
    deciding: 'assets/sounds/deciding.mp3',
    boom: 'assets/sounds/boom.mp3',
    select: 'assets/sounds/select.mp3',
    confirm: 'assets/sounds/confirm.mp3',
    summary: 'assets/sounds/summary.mp3',
};

const audioCache = new Map<string, HTMLAudioElement>();

const getAudio = (src: string, loop = false): HTMLAudioElement => {
    if (audioCache.has(src)) {
        return audioCache.get(src)!;
    }
    const audio = new Audio(src);
    audio.loop = loop;
    audioCache.set(src, audio);
    return audio;
};

// Helper to handle promise rejections from audio.play()
const handlePlayPromise = (promise: Promise<void> | undefined, soundName: string, soundPath: string) => {
    if (promise !== undefined) {
        promise.catch((e: DOMException) => {
            // Check for common error names and provide helpful, non-alarming logs.
            if (e.name === 'NotAllowedError') {
                // This is the autoplay error. It's a warning because we have logic to handle it.
                console.warn(`Music playback was prevented because the user hasn't interacted with the page yet. It will start automatically after the first user action.`);
            } else if (e.name === 'NotSupportedError') {
                 // This is the "no source" error. It's a warning because the user is expected to add files locally.
                 console.warn(`Audio file for "${soundName}" not found or format not supported. Please add the file to the path: ${soundPath}. See README.md for instructions.`);
            } else {
                // Log any other unexpected errors.
                console.error(`Sound play failed for ${soundName}:`, e);
            }
        });
    }
};

export const useSound = () => {
    const { gameState } = useGameState();
    const musicPlayerRef = useRef<HTMLAudioElement | null>(null);

    const playSound = useCallback((sound: SoundEffect) => {
        if (gameState.isSoundOn) {
            try {
                const audio = getAudio(soundFiles[sound]);
                audio.currentTime = 0;
                
                const baseVolume = (sound === 'click' || sound === 'move' || sound === 'select') ? 0.7 : 1.0;
                audio.volume = gameState.soundVolume * baseVolume;

                const promise = audio.play();
                handlePlayPromise(promise, sound, soundFiles[sound]);
            } catch (error) {
                console.error(`Could not play sound ${sound}:`, error);
            }
        }
    }, [gameState.isSoundOn, gameState.soundVolume]);

    const playMusic = useCallback(() => {
        if (gameState.isMusicOn) {
            try {
                // If track changes or no player exists, create a new one
                const currentTrackUrl = new URL(gameState.activeMusicUrl, window.location.origin).href;
                if (!musicPlayerRef.current || musicPlayerRef.current.src !== currentTrackUrl) {
                     if (musicPlayerRef.current) {
                        musicPlayerRef.current.pause();
                    }
                    musicPlayerRef.current = getAudio(gameState.activeMusicUrl, true);
                }
                musicPlayerRef.current.volume = gameState.musicVolume;
                const promise = musicPlayerRef.current.play();
                handlePlayPromise(promise, 'music', gameState.activeMusicUrl);
            } catch (error) {
                console.error("Could not play music:", error)
            }
        }
    }, [gameState.isMusicOn, gameState.activeMusicUrl, gameState.musicVolume]);

    const stopMusic = useCallback(() => {
        if (musicPlayerRef.current) {
            musicPlayerRef.current.pause();
            musicPlayerRef.current.currentTime = 0;
        }
    }, []);

    // Effect to handle live volume changes
    useEffect(() => {
        if (musicPlayerRef.current) {
            musicPlayerRef.current.volume = gameState.musicVolume;
        }
    }, [gameState.musicVolume]);

    // This effect ensures music stops immediately if toggled off in settings
    useEffect(() => {
        if (!gameState.isMusicOn) {
            stopMusic();
        }
    }, [gameState.isMusicOn, stopMusic]);

    // Effect to handle page visibility changes (e.g., switching tabs, minimizing, screen off on mobile)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // If the page is hidden, pause the music
                if (musicPlayerRef.current) {
                    musicPlayerRef.current.pause();
                }
            } else {
                // If the page becomes visible again, resume music if it's supposed to be on
                if(gameState.isMusicOn) {
                    playMusic();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [playMusic, gameState.isMusicOn]);

    return { playSound, playMusic, stopMusic };
};