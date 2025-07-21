export const isRunningOnZed = () => {
    const termProgram = process.env.TERM_PROGRAM;
    return termProgram === 'zed';
};
