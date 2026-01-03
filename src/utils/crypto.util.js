import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

export const cryptoUtil = {
    hash: async (value) => {
        if (!value) throw new Error("Nothing to hash");
        return bcrypt.hash(String(value), SALT_ROUNDS);
    },

    compare: async (plain, hashed) => {
        if (!plain || !hashed) return false;
        return bcrypt.compare(String(plain), String(hashed));
    },
};