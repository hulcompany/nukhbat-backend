export declare enum ErrorCommonCodes {
    badInput = "BAD_INPUT",
    notFound = "NOT_FOUND",
    forbidden = "FORBIDDEN",
    conflict = "CONFLICT",
    internal = "INTERNAL",
    unprocessableEntity = "UNPROCESSABLE_ENTITY",
    unauthenticated = "UNAUTHENTICATED",
    unauthorized = "UNAUTHORIZED",
    invalidJwtToken = "INVALID_JWT_TOKEN",
    jwtTokenExpired = "JWT_TOKEN_EXPIRED",
    forbiddenQueryField = "FORBIDDEN_QUERY_FIELD",
    forbiddenBodyField = "FORBIDDEN_BODY_FIELD",
    wrongOtp = "WRONG_OTP",
    wrongPassword = "WRONG_PASSWORD",
    emailNotFound = "EMAIL_NOT_FOUND",
    userNotFound = "USER_NOT_FOUND",
    unknownError = "UNKNOWN_ERROR",
    passwordMissmatched = "PASSWORD_MISSMATCH",
    fileSizeNotAllowed = "FILE_SIZE_NOT_ALLOWED",
    fileTypeNotAppowed = "FILE_TYPE_NOT_ALLOWED",
    accountNotCompletedYet = "ACCOUNT_NOT_COMPLETED_YET",
    accountNotVerifiedYet = "ACCOUNT_NOT_VERIFIED_YET",
    invalidCredentials = "INVALID_CREDENTIALS",
    userAlreadyExists = "USER_ALREADY_EXISTS",
    versionNotSupported = "VERSION_NOT_SUPPORTED"
}
export declare function mapExceptionToCommonCode(exception: unknown): ErrorCommonCodes;
export declare const ErrorCommonDescriptions: Record<ErrorCommonCodes, string>;
//# sourceMappingURL=error.common.code.d.ts.map