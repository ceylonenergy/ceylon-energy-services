/**
 * An error that carries the HTTP status to answer with. Throw one from
 * any route; the central error handler turns it into
 * `{ ok: false, error: message }` with that status.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true; // safe to show the message to the user
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Please log in.') => new HttpError(401, msg);
const forbidden = (msg = 'You are not allowed to do that.') => new HttpError(403, msg);
const notFound = (msg = 'Not found.') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);
const tooLarge = (msg) => new HttpError(413, msg);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, tooLarge };
