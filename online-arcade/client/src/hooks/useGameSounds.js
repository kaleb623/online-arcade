import { useCallback } from 'react';

// Organized by Game Name
const SOUND_LIBRARY = {
  SnakeGame: {
    chomp: [
      'chomp1.mp3',
      'chomp2.mp3',
      'crunch.mp3',
    ],
    bonk: [
      'bonk1.mp3',
      'bonk2.mp3',
      'bonk3.mp3'
    ]
  },
  // Future games can go here easily:
  // Tetris: { rotate: [...], drop: [...] }
};

const useGameSounds = (gameName) => {
  
  const playSound = useCallback((type, volume = 0.5) => {
    // 1. Safety Check: Does this game exist in our library?
    const gameSounds = SOUND_LIBRARY[gameName];
    if (!gameSounds) {
      console.warn(`Game not found in Sound Library: ${gameName}`);
      return;
    }

    // 2. Get the list of files for the specific event (e.g., 'chomp')
    const files = gameSounds[type];
    if (!files || files.length === 0) {
      console.warn(`No sounds found for '${type}' in game '${gameName}'`);
      return;
    }

    // 3. Pick a random file
    const randomIndex = Math.floor(Math.random() * files.length);
    const selectedFile = files[randomIndex];

    // 4. Construct path INCLUDING the game folder
    // Result: /sounds/SnakeGame/chomp/chomp1.mp3
    const path = `/sounds/${gameName}/${type}/${selectedFile}`;

    const audio = new Audio(path);
    audio.volume = volume;
    
    audio.play().catch(err => {
      console.error("Audio play failed:", err);
    });

  }, [gameName]);

  return { playSound };
};

export default useGameSounds;