/**
 * The API as one Vercel Function, for a Vercel project whose Root
 * Directory is this repository's root: vercel.json sends every /api/*
 * request here and serves the built website (client/dist) itself.
 */
module.exports = require('../server/index.js');
