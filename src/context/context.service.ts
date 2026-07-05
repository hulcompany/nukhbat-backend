import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class Context {
  constructor(@Inject(REQUEST) private readonly req: Request) {}

  get user() {
    const user = this.req.context?.user;
    if (!user) throw new Error('No User');
    return user;
  }

  get userOrNull() {
    const user = this.req.context?.user;
    return user;
  }

  get schoolOrNull() {
    const school = this.req.context?.school;
    return school;
  }

  get school() {
    const school = this.req.context?.school;
    if (!school) throw new Error('No School');
    return school;
  }

  get context() {
    return this.req.context;
  }

  // get permissions() {
  //   const permissions = this.req.context.permissions;
  //   if (!permissions) throw new Error('No Permissions');
  //   return permissions;
  // }

  // get permissionsOrNull() {
  //   const permissions = this.req.permissions;
  //   return permissions;
  // }
}
