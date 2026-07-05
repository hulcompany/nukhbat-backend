import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const GetMemberContext = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().membershipContext;
  },
);