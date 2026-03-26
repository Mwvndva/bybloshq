
const setAuthCookie = (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
    };
    // Set primary jwt cookie
    res.cookie('jwt', token, cookieOptions);
    // Clear the legacy admin 'token' cookie to prevent it shadowing 'jwt'
    // This is safe — admin login will reset it immediately if needed
    res.clearCookie('token', { path: '/', httpOnly: true });
};

export { setAuthCookie };
