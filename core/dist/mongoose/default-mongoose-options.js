"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultDbOptions = defaultDbOptions;
function defaultDbOptions(params = {
    options: { virtuals: false, versionKey: false },
}) {
    let { toJSON, ...otherOptions } = params.options || {};
    params.options?.toJSON;
    return {
        ...otherOptions,
        toJSON: {
            ...toJSON,
            transform: (doc, ret, options) => {
                let finalObject;
                if (ret._id) {
                    let id = ret._id;
                    finalObject = { id, ...ret };
                    delete finalObject._id;
                }
                else {
                    finalObject = ret;
                }
                params.hideToJson?.forEach((e) => {
                    if (e in finalObject) {
                        delete finalObject[e];
                    }
                });
                if (toJSON?.transform instanceof Function) {
                    finalObject = toJSON.transform(doc, finalObject, options);
                }
                return finalObject;
            },
        },
    };
}
//# sourceMappingURL=default-mongoose-options.js.map