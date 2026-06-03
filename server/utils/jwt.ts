const jwt = require('jsonwebtoken');

type JwtSignOptions = { expiresIn?: string | number };

const defaultSignOptions: JwtSignOptions = {};

const signToken = (payload: string | object | Buffer, options: JwtSignOptions = defaultSignOptions) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: options.expiresIn || '30d',
  });

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = {
  signToken,
  verifyToken,
};

export {};
