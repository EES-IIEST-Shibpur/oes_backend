export const generateOTP = (length) => {
    let otp = '';
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        otp += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return otp;
};