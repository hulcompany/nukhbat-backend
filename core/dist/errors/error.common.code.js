"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCommonDescriptions = exports.ErrorCommonCodes = void 0;
exports.mapExceptionToCommonCode = mapExceptionToCommonCode;
const common_1 = require("@nestjs/common");
var ErrorCommonCodes;
(function (ErrorCommonCodes) {
    ErrorCommonCodes["badInput"] = "BAD_INPUT";
    ErrorCommonCodes["notFound"] = "NOT_FOUND";
    ErrorCommonCodes["forbidden"] = "FORBIDDEN";
    ErrorCommonCodes["conflict"] = "CONFLICT";
    ErrorCommonCodes["internal"] = "INTERNAL";
    ErrorCommonCodes["unprocessableEntity"] = "UNPROCESSABLE_ENTITY";
    ErrorCommonCodes["unauthenticated"] = "UNAUTHENTICATED";
    ErrorCommonCodes["unauthorized"] = "UNAUTHORIZED";
    ErrorCommonCodes["invalidJwtToken"] = "INVALID_JWT_TOKEN";
    ErrorCommonCodes["jwtTokenExpired"] = "JWT_TOKEN_EXPIRED";
    ErrorCommonCodes["forbiddenQueryField"] = "FORBIDDEN_QUERY_FIELD";
    ErrorCommonCodes["forbiddenBodyField"] = "FORBIDDEN_BODY_FIELD";
    ErrorCommonCodes["wrongOtp"] = "WRONG_OTP";
    ErrorCommonCodes["wrongPassword"] = "WRONG_PASSWORD";
    ErrorCommonCodes["emailNotFound"] = "EMAIL_NOT_FOUND";
    ErrorCommonCodes["userNotFound"] = "USER_NOT_FOUND";
    ErrorCommonCodes["unknownError"] = "UNKNOWN_ERROR";
    ErrorCommonCodes["passwordMissmatched"] = "PASSWORD_MISSMATCH";
    ErrorCommonCodes["fileSizeNotAllowed"] = "FILE_SIZE_NOT_ALLOWED";
    ErrorCommonCodes["fileTypeNotAppowed"] = "FILE_TYPE_NOT_ALLOWED";
    ErrorCommonCodes["accountNotCompletedYet"] = "ACCOUNT_NOT_COMPLETED_YET";
    ErrorCommonCodes["accountNotVerifiedYet"] = "ACCOUNT_NOT_VERIFIED_YET";
    ErrorCommonCodes["invalidCredentials"] = "INVALID_CREDENTIALS";
    ErrorCommonCodes["userAlreadyExists"] = "USER_ALREADY_EXISTS";
    ErrorCommonCodes["versionNotSupported"] = "VERSION_NOT_SUPPORTED";
})(ErrorCommonCodes || (exports.ErrorCommonCodes = ErrorCommonCodes = {}));
function mapExceptionToCommonCode(exception) {
    if (exception instanceof common_1.NotFoundException) {
        return ErrorCommonCodes.notFound;
    }
    if (exception instanceof common_1.ConflictException) {
        return ErrorCommonCodes.conflict;
    }
    if (exception instanceof common_1.BadRequestException) {
        return ErrorCommonCodes.badInput;
    }
    if (exception instanceof common_1.ForbiddenException) {
        return ErrorCommonCodes.forbidden;
    }
    if (exception instanceof common_1.UnauthorizedException) {
        return ErrorCommonCodes.unauthenticated;
    }
    if (exception instanceof common_1.UnprocessableEntityException) {
        return ErrorCommonCodes.unprocessableEntity;
    }
    if (exception instanceof common_1.InternalServerErrorException) {
        return ErrorCommonCodes.internal;
    }
    if (exception instanceof common_1.HttpException) {
        // Fallback based on status code
        switch (exception.getStatus()) {
            case 400:
                return ErrorCommonCodes.badInput;
            case 401:
                return ErrorCommonCodes.unauthenticated;
            case 403:
                return ErrorCommonCodes.forbidden;
            case 404:
                return ErrorCommonCodes.notFound;
            case 409:
                return ErrorCommonCodes.conflict;
            case 422:
                return ErrorCommonCodes.unprocessableEntity;
            case 500:
                return ErrorCommonCodes.internal;
            default:
                return ErrorCommonCodes.unknownError;
        }
    }
    return ErrorCommonCodes.unknownError;
}
exports.ErrorCommonDescriptions = {
    [ErrorCommonCodes.badInput]: 'The request contains invalid input.',
    [ErrorCommonCodes.notFound]: 'The requested resource was not found.',
    [ErrorCommonCodes.forbidden]: 'Access to this resource is forbidden.',
    [ErrorCommonCodes.conflict]: 'The resource already exists or conflicts.',
    [ErrorCommonCodes.internal]: 'An internal server error occurred.',
    [ErrorCommonCodes.unprocessableEntity]: 'The request could not be processed.',
    [ErrorCommonCodes.unauthenticated]: 'Authentication is required.',
    [ErrorCommonCodes.unauthorized]: 'You are not authorized.',
    [ErrorCommonCodes.invalidJwtToken]: 'The JWT token is invalid.',
    [ErrorCommonCodes.jwtTokenExpired]: 'The JWT token has expired.',
    [ErrorCommonCodes.forbiddenQueryField]: 'A query field is not allowed.',
    [ErrorCommonCodes.forbiddenBodyField]: 'A body field is not allowed.',
    [ErrorCommonCodes.wrongOtp]: 'The OTP is incorrect.',
    [ErrorCommonCodes.wrongPassword]: 'The password is incorrect.',
    [ErrorCommonCodes.emailNotFound]: 'Email address was not found.',
    [ErrorCommonCodes.userNotFound]: 'User was not found.',
    [ErrorCommonCodes.unknownError]: 'An unknown error occurred.',
    [ErrorCommonCodes.passwordMissmatched]: 'Passwords do not match.',
    [ErrorCommonCodes.fileSizeNotAllowed]: 'File size is not allowed.',
    [ErrorCommonCodes.fileTypeNotAppowed]: 'File type is not allowed.',
    [ErrorCommonCodes.accountNotCompletedYet]: 'Account setup is not complete.',
    [ErrorCommonCodes.invalidCredentials]: 'Invalid credentials.',
    [ErrorCommonCodes.userAlreadyExists]: 'User already exists.',
    [ErrorCommonCodes.versionNotSupported]: 'Version is not supported.',
    [ErrorCommonCodes.accountNotVerifiedYet]: 'Account Not Verified yet',
};
//# sourceMappingURL=error.common.code.js.map