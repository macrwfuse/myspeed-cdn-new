/**
 * 修复 Bun 在 Windows 下 os.networkInterfaces() 返回的网卡名乱码。
 *
 * Bun 会把网卡名的 UTF-8 字节按 Latin-1 解码，例如 "以太网" 变成 "ä»¥å¤ªç½"
 * （Node.js 无此问题，返回的是正确的 UTF-8 字符串）。
 * 本函数检测这种 mojibake 并还原为正确的字符串；不是乱码时原样返回。
 */
export const fixMojibake = (value) => {
    if (typeof value !== "string" || value.length === 0) return value;

    let hasHighLatin = false;
    for (const char of value) {
        const code = char.codePointAt(0);
        // 含真正的多字节字符（如正确的中文）→ 不是 mojibake，原样返回
        if (code > 0xff) return value;
        if (code >= 0x80) hasHighLatin = true;
    }
    // 纯 ASCII → 无需修复
    if (!hasHighLatin) return value;

    try {
        const repaired = Buffer.from(value, "latin1").toString("utf8");
        // 还原结果必须是无替换字符的有效 UTF-8，否则原串并非被误读的 UTF-8
        if (repaired.includes("\ufffd") || repaired === value) return value;
        return repaired;
    } catch {
        return value;
    }
};
