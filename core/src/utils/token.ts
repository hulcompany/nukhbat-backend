import * as Jwt from "jsonwebtoken";

interface TokenResult {
  data: any;
  isExpired: boolean;
  isWrong: boolean;
  hasError: boolean;
}

export function signToken({
  params,
  expires,
  key,
}: {
  params: object;
  expires?: any;
  key?: string;
}): string {
  return Jwt.sign(params, key || process.env.JWT!, {
    expiresIn: expires || "90d",
  });
}

export function decodeToken(jwt: string , key?: string): TokenResult {
  try {
    const decoded = Jwt.verify(jwt, key || process.env.JWT!);
    return {
      data: decoded,
      hasError: false,
      isExpired: false,
      isWrong: false,
    };
  } catch (err) {
    return {
      data: null,
      hasError: true,
      isExpired: (err as any).name == "TokenExpiredError",
      isWrong: (err as any).name == "JsonWebTokenError",
    };
  }
}

