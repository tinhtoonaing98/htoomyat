const bcrypt = require('bcryptjs');

const plainPassword = '123';
const storedHash = '$2b$08$Z5SCEz1aeDM7.JJ39Qz1GOZ/34jWTQH7k3O.JupLXG.9PGl7DYDTq';

const result = bcrypt.compareSync(plainPassword, storedHash);
console.log('Password match:', result);
