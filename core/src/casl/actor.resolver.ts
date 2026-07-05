export type Actor = any;

export type ActorResolver = (request: any) => Actor;

export const defaultActorResolver: ActorResolver = (req) => {
  return req.user;
};