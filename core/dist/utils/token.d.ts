interface TokenResult {
    data: any;
    isExpired: boolean;
    isWrong: boolean;
    hasError: boolean;
}
export declare function signToken({ params, expires, key, }: {
    params: object;
    expires?: any;
    key?: string;
}): string;
export declare function decodeToken(jwt: string, key?: string): TokenResult;
export {};
//# sourceMappingURL=token.d.ts.map