// src/middleware/notFound.js
const notFound = (req, res) => res.status(404).send('Route does not exist');

module.exports = notFound;