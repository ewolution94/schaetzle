import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// Plain ESM modules shared with the production server.
// @ts-expect-error untyped server module
import { createCensus } from './server/census.mjs';
// @ts-expect-error untyped server module
import { createApi } from './server/api.mjs';
// @ts-expect-error untyped server module
import { createGames } from './server/game.mjs';
// @ts-expect-error untyped server module
import { createImages } from './server/images.mjs';
// @ts-expect-error untyped server module
import { createSource } from './server/items/index.mjs';

// The real game server inside Vite's (dev and preview), so `npm run dev` is the whole app on one
// port: the same API, photo pass-through and Census forwarder as server/server.mjs.
function server(): Plugin {
  const census = createCensus({ site: 'schaetzle' });
  const images = createImages();
  const source = createSource(process.env, { images });
  const games = createGames({ source });
  const api = createApi({ games, demo: source.demo });
  const ticker = setInterval(() => games.tick(), 5000);
  ticker.unref();

  const middleware = async (req: any, res: any, next: (error?: unknown) => void) => {
    try {
      if (await census(req, res)) return;
      if (await api.handle(req, res)) return;
      if (await images.handle(req, res)) return;
      next();
    } catch (error) {
      next(error);
    }
  };
  return {
    name: 'schaetzle-server',
    configureServer: (s) => void s.middlewares.use(middleware),
    configurePreviewServer: (s) => void s.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [svelte(), server()],
  // 5800 is the NAS port; locally the previews run beside it.
  server: { port: 5810, strictPort: true },
  preview: { port: 5811, strictPort: true },
  build: {
    target: 'es2022',
    // Browsers with native light-dark(): the default target makes Lightning CSS resolve the
    // tokens once at :root (Folio's finding), and the page relies on them following the theme.
    cssTarget: ['chrome123', 'safari17.5', 'firefox120'],
  },
});
