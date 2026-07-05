import { SchemaOptions } from "mongoose";

interface Params<T> {
  hideToJson?: string[];
  options?: SchemaOptions<T>;
}

export function defaultDbOptions<T>(
  params: Params<T> = {
    options: { virtuals: false, versionKey: false },
  },
): any {
  let { toJSON, ...otherOptions } = params.options || {};
  params.options?.toJSON;
  return {
    ...otherOptions,
    toJSON: {
      ...toJSON,
      transform: (doc, ret, options) => {
        let finalObject: any;
        if (ret._id) {
          let id = ret._id;
          finalObject = { id, ...ret };
          delete (finalObject as any)._id;
        } else {
          finalObject = ret;
        }
        params.hideToJson?.forEach((e) => {
          if (e in finalObject) {
            delete (finalObject as any)[e];
          }
        });
        if (toJSON?.transform instanceof Function) {
          finalObject = toJSON!.transform(doc, finalObject, options);
        }
        return finalObject;
      },
    },
  } as SchemaOptions<T>;
}
