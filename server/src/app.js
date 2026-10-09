/**
 * The Express application: API routes, security headers, and — in
 * production — the built React app. Kept separate from server.js so the
 * tests can use the app without opening a port.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { env } = require('./config/env');
const { errorHandler, notFoundApi } = require('./middleware/error');
const { ADMIN_HEADER } = require('./middleware/auth');

/**
 * Strip a hosting prefix off incoming URLs.
 *
 * cPanel/Passenger can publish the app under a folder of an existing
 * site (e.g. example.com/nodeapi) and hands requests over with that
 * prefix still attached, so "/nodeapi/api/health" would match nothing.
 * Passenger only sets PASSENGER_BASE_URI in that case, so this is a no-op
 * everywhere else.
 */
function withoutBaseUri(url, base) {
  if (!base) return url;
  const q = url.indexOf('?');
  const pathname = q === -1 ? url : url.slice(0, q);
  const query = q === -1 ? '' : url.slice(q);
  if (pathname === base) return `/${query}`;
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) + query;
  return url;
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  const baseUri = (process.env.PASSENGER_BASE_URI || '').replace(/\/+$/, '');
  if (baseUri) {
    app.use((req, res, next) => {
      req.url = withoutBaseUri(req.url, baseUri);
      next();
    });
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          // pdf.js (admin only) may compile WebAssembly for some PDFs.
          'script-src': ["'self'", "'wasm-unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          'connect-src': ["'self'"],
          'worker-src': ["'self'", 'blob:'],
          'frame-ancestors': ["'self'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: env.isProd,
    })
  );

  // Only matters when the React app is hosted on a different origin.
  app.use(
    '/api',
    cors({
      origin(origin, callback) {
        callback(null, !origin || env.allowedOrigins.includes(origin));
      },
      credentials: true,
      allowedHeaders: ['Content-Type', ADMIN_HEADER],
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      maxAge: 600,
    })
  );

  app.use(compression());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use(cookieParser());
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '200kb' }));

  /* ---- API ---- */
  app.use('/api', require('./routes/public'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', notFoundApi);

  /* ---- React app (after `npm run build`) ---- */
  const indexHtml = path.join(env.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(env.clientDist, {
        index: false,
        setHeaders(res, filePath) {
          // Vite puts content-hashed bundles in /static: their names change
          // whenever their content does, so they can be cached forever.
          if (filePath.includes(`${path.sep}static${path.sep}`)) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.set('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );
    // Every other GET is a page of the single-page app (/, /admin, ...).
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  } else if (!env.isTest) {
    app.get('/', (req, res) => {
      res
        .type('text')
        .send('The API is running. The website is not built yet: run "npm run build", or use "npm run dev" and open http://localhost:5173');
    });
  }

  app.use(errorHandler);
  return app;
}

// module.exports = { createApp, withoutBaseUri };
module.exports = app;
