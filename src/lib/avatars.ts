// The emoji a player can pick for their avatar (components/AvatarButton.svelte), in groups. All are
// Emoji 12 or older, so they draw on the meeting room's older Windows machines too. The server takes
// any single emoji (server/game.mjs → cleanEmoji); this list is only what the picker offers.

import type { Key } from './i18n.svelte';

export const AVATARS: { label: Key; emoji: string[] }[] = [
  {
    label: 'avatarAnimals',
    emoji: ['🦊', '🐼', '🐨', '🐻', '🐯', '🦁', '🐵', '🐶', '🐱', '🐸', '🐙', '🦄', '🐝', '🦉', '🐢', '🦖', '🐳', '🦩', '🐧', '🦔', '🐌', '🦦', '🦋', '🐞'],
  },
  {
    label: 'avatarFood',
    emoji: ['🍕', '🌮', '🍔', '🌭', '🍟', '🥨', '🥐', '🍩', '🧁', '🍦', '🍿', '🍣', '🥑', '🍉', '🍓', '🥕'],
  },
  {
    label: 'avatarThings',
    emoji: ['🚀', '🛸', '🎲', '🎯', '🎸', '🎩', '💎', '💰', '🛒', '🧸', '🎈', '🔮', '🧲', '⚽', '🏀', '🪀'],
  },
  {
    label: 'avatarNature',
    emoji: ['🌵', '🍄', '🌻', '🍀', '🌈', '⭐', '🔥', '⚡', '🌙', '☀️', '❄️', '🌊'],
  },
  {
    label: 'avatarFaces',
    emoji: ['😎', '🤓', '🥳', '🤠', '😺', '🤖', '👾', '👻', '👽', '🤡', '🧙', '🦸'],
  },
];
