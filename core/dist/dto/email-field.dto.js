"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailField = EmailField;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function EmailField(validationOptions) {
    return (0, common_1.applyDecorators)((0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value), (0, class_validator_1.IsEmail)({}, validationOptions));
}
//# sourceMappingURL=email-field.dto.js.map