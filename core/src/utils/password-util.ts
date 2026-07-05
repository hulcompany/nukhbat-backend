import bcrypt from "bcrypt";

export async function hashPassword(
    password: string,
    salt: number
): Promise<string> {
    return await bcrypt.hash(password, salt);
}


export async function comparePassword(
    hash: string,
    password: string
): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}
