export type Command = {
    onExecute: (params: any) => Promise<void>;
    onAbort: () => Promise<void>;
    abortOnESC: boolean;
};
