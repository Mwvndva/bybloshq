
const setAuthCookie = (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
    };

    if (process.env.NODE_ENV === 'development') {
        delete cookieOptions.domain;
    }

    res.cookie('jwt', token, cookieOptions);
};

export { setAuthCookie };
